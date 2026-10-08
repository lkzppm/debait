import { APICallError, generateText, Output, type LanguageModel, type LanguageModelUsage } from "ai";
import type { BotReply, Judgement, Ruling } from "@/lib/debate/types";
import { addUsage, BudgetError, checkBudget } from "@/lib/usage";
import { JudgeError } from "./errors";
import { groq, JUDGE_MODEL_ID, judgeModel, MENTION_MODEL_ID, mentionModel, mentionModelWithTrace } from "./models";
import { aliasMessages, prompts } from "./prompts";
import { judgementSchema, mentionSchema, rulingSchema, type MentionOutput } from "./schema";
import type { EngineResult, JudgeEngine, JudgeInput, MentionInput, RulingInput, TranscriptLine } from "./types";

/**
 * The real engine: Groq through the AI SDK. Every call checks the daily
 * budget first, reports its tokens afterwards, caps its output and refuses
 * to trust an answer that did not finish with "stop".
 */

// gpt-oss spends output tokens on reasoning too; "low" keeps that small and fast.
const PROVIDER_OPTIONS = { groq: { reasoningEffort: "low" as const } };

interface CallOptions {
  roomId: string;
  modelId: string;
  model: LanguageModel;
  instructions: string;
  prompt: string;
  maxOutputTokens: number;
}

/** Budget check, the call, usage accounting and error mapping around one generation. */
async function tracked<T extends { finishReason: string; totalUsage: LanguageModelUsage }>(
  options: CallOptions,
  call: () => Promise<T>,
): Promise<T> {
  try {
    await checkBudget(options.modelId);
  } catch (error) {
    throw error instanceof BudgetError ? new JudgeError("budget_exceeded", error) : error;
  }
  let result: T;
  try {
    result = await call();
  } catch (error) {
    const limited = APICallError.isInstance(error) && error.statusCode === 429;
    throw new JudgeError(limited ? "rate_limited" : "engine_error", error);
  }
  const usage = result.totalUsage;
  await addUsage(options.roomId, options.modelId, {
    input: usage.inputTokens ?? 0,
    output: usage.outputTokens ?? 0,
    total: usage.totalTokens ?? 0,
  });
  // "length" means the output budget ran out mid-answer (reasoning included).
  if (result.finishReason === "length") throw new JudgeError("truncated");
  if (result.finishReason !== "stop") throw new JudgeError("engine_error", result.finishReason);
  return result;
}

/** One structured generation: the schema goes to Groq as a strict JSON schema. */
async function structured<T>(options: CallOptions, schema: Parameters<typeof Output.object<T>>[0]["schema"]): Promise<T> {
  const result = await tracked(options, () =>
    generateText({
      model: options.model,
      instructions: options.instructions,
      prompt: options.prompt,
      output: Output.object({ schema }),
      maxOutputTokens: options.maxOutputTokens,
      maxRetries: 1,
      providerOptions: PROVIDER_OPTIONS,
    }),
  );
  try {
    return result.output as T;
  } catch (error) {
    throw new JudgeError("invalid_output", error);
  }
}

const severity = (value: number) => Math.min(3, Math.max(1, Math.round(value))) as 1 | 2 | 3;

async function judgeMessage(input: JudgeInput): Promise<EngineResult<Judgement>> {
  const p = prompts(input.locale);
  const output = await structured(
    {
      roomId: input.roomId,
      modelId: JUDGE_MODEL_ID,
      model: judgeModel(),
      instructions: p.judgeSystem(input.strictness),
      prompt: p.judgeUser(input),
      maxOutputTokens: 1600,
    },
    judgementSchema,
  );
  return {
    value: { ...output, fallacies: output.fallacies.map((flag) => ({ ...flag, severity: severity(flag.severity) })) },
    engine: "groq",
    model: JUDGE_MODEL_ID,
  };
}

function toReply(output: MentionOutput, byAlias: Map<string, string>, replyTo: TranscriptLine | null): BotReply {
  // A reply to a specific message always rules on that message.
  const target = replyTo?.id ?? (output.targetMessageId ? byAlias.get(output.targetMessageId.trim()) : undefined);
  return {
    intent: output.intent,
    text: output.text,
    sources: output.sources,
    ruling:
      output.intent === "validate" && output.status && target
        ? { targetMessageId: target, claimQuote: output.claimQuote ?? "", status: output.status }
        : null,
  };
}

/** The answer without its INTENT/STATUS/TARGET/CLAIM header lines. */
const HEADER = /^\s*(INTENT|STATUS|TARGET|CLAIM)\s*:.*$/gim;

/**
 * Reads the header lines in code. Groq allows 8,000 tokens a minute and one
 * search counts about 7,000 (the pages read are input), so a second model call
 * right after it to sort the answer into fields hits the limit. The headers are
 * plain lines: the sorting call is only made when they are missing.
 */
function readHeaders(answer: string, body: string, sources: { title: string; url: string }[]): MentionOutput | null {
  const field = (name: string) => new RegExp(`^\\s*${name}\\s*:[ \\t]*(.*)$`, "im").exec(answer)?.[1]?.trim() ?? "";
  const intent = /^(validate|search|explain|off_topic)\b/i.exec(field("INTENT"))?.[1]?.toLowerCase() as MentionOutput["intent"] | undefined;
  if (!intent) return null;
  const status = /^(confirmed|imprecise|false|unverifiable)\b/i.exec(field("STATUS"))?.[1]?.toLowerCase() as MentionOutput["status"] | undefined;
  const target = /\bm\d+\b/i.exec(field("TARGET"))?.[0]?.toLowerCase() ?? null;
  const claim = field("CLAIM").replace(/^["“”']+|["“”']+$/g, "").trim() || null;
  const validate = intent === "validate";
  return {
    intent,
    text: body,
    status: validate ? (status ?? "unverifiable") : null,
    targetMessageId: validate ? target : null,
    claimQuote: validate ? claim : null,
    sources,
  };
}

/** One web-search generation, with the pages it found and opened read from the raw response. */
async function searchStep(input: MentionInput, base: { roomId: string; modelId: string }, user: string, retry: boolean) {
  const p = prompts(input.locale);
  const traced = mentionModelWithTrace({ forceSearch: retry });
  const options = {
    ...base,
    model: traced.model,
    instructions: retry ? `${p.mentionSearchSystem(input)}\n\n${p.mentionRetry}` : p.mentionSearchSystem(input),
    prompt: user,
    maxOutputTokens: 1400,
  };
  const search = await tracked(options, () =>
    generateText({
      model: options.model,
      instructions: options.instructions,
      prompt: options.prompt,
      tools: { browser_search: groq().tools.browserSearch({}) },
      // "auto" for the SDK; a retry requires the search in the request itself (see `mentionModelWithTrace`).
      toolChoice: "auto",
      maxOutputTokens: options.maxOutputTokens,
      // A minute's token limit clears within seconds of a search: wait and try again rather than fail.
      maxRetries: 3,
      providerOptions: PROVIDER_OPTIONS,
    }),
  );
  const trace = await traced.trace();
  // The answer cites results by number (【3†L11-L15】): those pages, plus the ones
  // the model opened, are its sources; failing both, the first results found.
  const cited = [...search.text.matchAll(/【(\d+)†/g)].map((match) => trace.results[Number(match[1])]).filter((hit) => hit !== undefined);
  const seen = new Set<string>();
  const opened = [...trace.opened, ...cited, ...(trace.opened.length + cited.length > 0 ? [] : trace.results.slice(0, 3))].filter(
    (hit) => !seen.has(hit.url) && seen.add(hit.url),
  );
  // The room shows plain text: citation marks and markdown emphasis go.
  const answer = search.text
    .replace(/【[^】]*】/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/^[ \t]*[*-][ \t]+/gm, "• ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  const body = answer.replace(HEADER, "").trim();
  const intent = /^\s*INTENT\s*:\s*(\w+)/im.exec(answer)?.[1]?.toLowerCase();
  if (process.env.JUDGE_DEBUG) {
    console.error("[groq] search step", { retry, finishReason: search.finishReason, found: trace.results.length, opened: trace.opened.length, cited: cited.length, sources: opened, text: answer });
  }
  return { answer, body, opened, found: trace.results.length, wantsWeb: intent === "validate" || intent === "search" };
}

async function answerMention(input: MentionInput): Promise<EngineResult<BotReply>> {
  const p = prompts(input.locale);
  const { lines, byAlias } = aliasMessages(input);
  const replyAlias = input.replyTo ? (lines.find((line) => line.id === input.replyTo!.id)?.alias ?? null) : null;
  const base = { roomId: input.roomId, modelId: MENTION_MODEL_ID, model: mentionModel() };
  const user = p.mentionUser(input, lines, replyAlias);

  // No challenges left: one call without tools, which can only explain or decline.
  if (!input.canSearch) {
    const output = await structured(
      { ...base, instructions: p.mentionOfflineSystem(input), prompt: user, maxOutputTokens: 800 },
      mentionSchema,
    );
    const reply = toReply({ ...output, status: null, sources: [] }, byAlias, null);
    const intent = reply.intent === "explain" ? "explain" : "off_topic";
    return { value: { ...reply, intent, ruling: null }, engine: "groq", model: MENTION_MODEL_ID };
  }

  // Step 1: free text with Groq's built-in web search. The 20b searches well but, in
  // CV-AI's tests, could not also produce the final JSON in the same call. The
  // pages it saw come from the raw response (the provider drops them).
  // The 20b sometimes writes only the header lines and stops without searching
  // or answers from memory (seen 2026-10-07 on "pesquise sobre..."): then it gets
  // one more try with the search required. A second empty answer is a failure, not a blank bubble.
  let attempt = await searchStep(input, base, user, false);
  if (!attempt.body || (attempt.wantsWeb && attempt.found === 0)) attempt = await searchStep(input, base, user, true);
  if (!attempt.body) throw new JudgeError("invalid_output", "the search step wrote no answer");
  const { answer, opened } = attempt;

  // Step 2: the fields come from the header lines; only without them, a small structured call sorts the answer.
  const output =
    readHeaders(answer, attempt.body, opened) ??
    (await structured(
      {
        ...base,
        instructions: p.classifySystem(lines.map((line) => line.alias)),
        prompt: p.classifyUser(answer, opened.map((source) => source.url)),
        maxOutputTokens: 900,
      },
      mentionSchema,
    ));
  // Pages the search tool really opened win over URLs the model wrote down.
  const sources = opened.length > 0 ? opened.slice(0, 5) : output.sources;
  // The sorting call may drop the text; the search step's own words are the answer then.
  const text = output.text.trim() || attempt.body;
  return { value: toReply({ ...output, text, sources }, byAlias, input.replyTo), engine: "groq", model: MENTION_MODEL_ID };
}

async function writeRuling(input: RulingInput): Promise<EngineResult<Ruling>> {
  const p = prompts(input.locale);
  const lines = input.transcript.map((line, index) => ({ ...line, alias: `m${index + 1}` }));
  const output = await structured(
    {
      roomId: input.roomId,
      modelId: JUDGE_MODEL_ID,
      model: judgeModel(),
      instructions: p.rulingSystem(),
      prompt: p.rulingUser(input, lines),
      maxOutputTokens: 1000,
    },
    rulingSchema,
  );
  return {
    value: { text: output.text, best: { a: output.bestA, b: output.bestB }, advice: { a: output.adviceA, b: output.adviceB } },
    engine: "groq",
    model: JUDGE_MODEL_ID,
  };
}

export const groqEngine: JudgeEngine = { judgeMessage, answerMention, writeRuling };
