import { createGroq } from "@ai-sdk/groq";

/**
 * Groq provider and the two models the bot runs on. Groq's rate limits are
 * per model, so the judge and the mention each get their own budget.
 * Docs: https://console.groq.com/docs/models
 */

/** Structured judgement and the closing ruling. Only the 120b held large schemas in CV-AI's tests. */
export const JUDGE_MODEL_ID = process.env.GROQ_JUDGE_MODEL || "openai/gpt-oss-120b";

/** The @mention. Needs the built-in `browser_search` tool, available only on `openai/gpt-oss-*`. */
export const MENTION_MODEL_ID = process.env.GROQ_MENTION_MODEL || "openai/gpt-oss-20b";

let provider: ReturnType<typeof createGroq> | undefined;

/** Created on first use, so importing this file never needs the API key. */
export function groq() {
  provider ??= createGroq({ apiKey: process.env.GROQ_API_KEY });
  return provider;
}

export const judgeModel = () => groq()(JUDGE_MODEL_ID);
export const mentionModel = () => groq()(MENTION_MODEL_ID);

/** One page the built-in browser search found or opened. */
export interface SearchHit {
  title: string;
  url: string;
}

/**
 * What Groq's browser search did during one call. The AI SDK provider drops
 * it (`result.sources` stays empty), but the raw response carries it in
 * `message.executed_tools`: every search's result list, and every page the
 * model opened. Read it by wrapping `fetch` for that one call.
 */
export interface SearchTrace {
  /** Every result of every search, in order; citation numbers index this list. */
  results: SearchHit[];
  /** Pages the model opened, as it wrote them. */
  opened: SearchHit[];
}

interface ExecutedTool {
  name?: string;
  type?: string;
  arguments?: string;
  search_results?: { results?: { title?: string; url?: string }[] };
}

function parseTrace(body: unknown, trace: SearchTrace) {
  const message = (body as { choices?: { message?: { executed_tools?: ExecutedTool[] } }[] })?.choices?.[0]?.message;
  for (const tool of message?.executed_tools ?? []) {
    for (const hit of tool.search_results?.results ?? []) {
      if (hit.url) trace.results.push({ title: hit.title?.trim() || hit.url, url: hit.url });
    }
    if (tool.name === "browser.open" || tool.type === "browser_open") {
      try {
        const args = JSON.parse(tool.arguments ?? "{}") as { id?: number | string; url?: string };
        const byId = typeof args.id === "number" ? trace.results[args.id] : undefined;
        const url = typeof args.url === "string" ? args.url : (typeof args.id === "string" ? args.id : undefined);
        if (byId) trace.opened.push(byId);
        else if (url?.startsWith("http")) trace.opened.push({ title: url, url });
      } catch {
        // Arguments that are not JSON: nothing to record.
      }
    }
  }
}

/**
 * A mention model whose single response is also read raw, so the search
 * trace is available next to the SDK's result. Use it for one call only.
 */
export function mentionModelWithTrace() {
  const trace: SearchTrace = { results: [], opened: [] };
  let pending: Promise<void> = Promise.resolve();
  const provider = createGroq({
    apiKey: process.env.GROQ_API_KEY,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      if (response.ok) {
        pending = response
          .clone()
          .json()
          .then((body) => parseTrace(body, trace))
          .catch(() => {});
      }
      return response;
    },
  });
  return { model: provider(MENTION_MODEL_ID), trace: async () => (await pending, trace) };
}
