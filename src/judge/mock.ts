import type { FallacyId } from "@/i18n/fallacies";
import type { Locale } from "@/i18n/locales";
import { BRAND } from "@/lib/brand";
import type { BotReply, Claim, FallacyFlag, Judgement, MentionIntent, Ruling, Seat, ValidationStatus } from "@/lib/debate/types";
import type { EngineResult, JudgeEngine, JudgeInput, MentionInput, RulingInput, TranscriptLine } from "./types";

/**
 * A judge that needs no API key: keyword heuristics, deterministic from the
 * text, so the interface can be built and demoed without spending quota.
 * It understands nothing. Everything it writes says "[mock]" so its output
 * is never mistaken for a real judgement.
 */

const MODEL = "mock";

/** FNV-1a: the same text always gives the same ratings, statuses and latency. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const latency = (text: string) => sleep(600 + (hash(text) % 600));
const clamp = (value: number) => Math.round(Math.min(10, Math.max(0, value)));
const result = <T,>(value: T): EngineResult<T> => ({ value, engine: "mock", model: MODEL });

/** Sentences as exact substrings of the text, so they work as verbatim quotes. */
function sentences(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?]*/g) ?? []).map((part) => part.trim()).filter((part) => part.length > 2);
}

/** The comma-separated clauses of a sentence, also exact substrings. */
function clauses(sentence: string): string[] {
  return (sentence.match(/[^,;:]+/g) ?? []).map((part) => part.trim()).filter((part) => part.length > 2);
}

const side = (seat: Seat) => (seat === "a" ? "A" : "B");
const say = (locale: Locale, pt: string, en: string) => `[mock] ${locale === "pt" ? pt : en}`;

interface Rule {
  type: FallacyId;
  pattern: RegExp;
  severity: 1 | 2 | 3;
  pt: string;
  en: string;
}

const RULES: Rule[] = [
  {
    type: "ad_hominem",
    pattern: /\b(idiotas?|burr[oa]s?|ignorantes?|imbecil|imbecis|est[úu]pid[oa]s?|stupid|idiots?|morons?|ignorant|dumb)\b/i,
    severity: 2,
    pt: "O trecho ataca a pessoa. Uma versão válida criticaria o argumento dela.",
    en: "The passage attacks the person. A valid version would criticise their argument.",
  },
  {
    type: "ad_populum",
    pattern: /(todo mundo (sabe|concorda|acha)|todos sabem|everyone (knows|agrees)|everybody (knows|agrees))/i,
    severity: 1,
    pt: "Muita gente acreditar não torna algo verdade. Faltou uma razão ou um dado.",
    en: "Many people believing it does not make it true. A reason or a figure is missing.",
  },
  {
    type: "false_dilemma",
    pattern: /(\bou\b.+\bou\b|\beither\b.+\bor\b)/i,
    severity: 2,
    pt: "Só duas opções foram apresentadas. Uma versão válida mostraria por que não há outras.",
    en: "Only two options were offered. A valid version would show why there are no others.",
  },
  {
    type: "hasty_generalization",
    pattern: /\b(sempre|nunca|todos os|todas as|ningu[ée]m|always|never|nobody|all of them)\b/i,
    severity: 1,
    pt: "A conclusão vale para todos os casos sem base para isso. Um dado ou um limite resolveria.",
    en: "The conclusion covers every case without support. A figure or a limit would fix it.",
  },
  {
    type: "slippery_slope",
    pattern: /(daqui a pouco|vai acabar em|logo depois vem|next thing you know|will inevitably|sooner or later)/i,
    severity: 2,
    pt: "A cadeia de consequências não foi sustentada passo a passo.",
    en: "The chain of consequences was not supported step by step.",
  },
  {
    type: "appeal_authority",
    pattern: /(especialistas dizem|cientistas dizem|meu professor disse|experts say|scientists say|my teacher said)/i,
    severity: 1,
    pt: "Quem disse não é prova. Uma versão válida citaria o estudo ou o dado.",
    en: "Who said it is not proof. A valid version would cite the study or the figure.",
  },
  {
    type: "whataboutism",
    pattern: /(e voc[êe]s?\?|e o seu lado|mas e (o|a|os|as)\b|what about)/i,
    severity: 2,
    pt: "O trecho desvia da crítica apontando para o outro lado, sem respondê-la.",
    en: "The passage deflects the criticism by pointing at the other side instead of answering it.",
  },
  {
    type: "burden_shift",
    pattern: /(prov[ea] que n[ãa]o|prove me wrong|prove (that )?it is ?n[o']t)/i,
    severity: 2,
    pt: "Quem afirma é quem precisa sustentar. Aqui o ônus foi passado ao adversário.",
    en: "Whoever makes the claim has to support it. Here the burden was passed to the opponent.",
  },
];

const MANIPULATION =
  /((ignor[ea]|esque[çc]a|desconsidere|disregard|forget)\b.{0,40}(instru|regras|rules|previous|anteriores)|me d[êe] \d+ pontos|give me \d+ points|(voc[êe] [ée] agora|you are now))/i;
const CONNECTIVES = /\b(porque|pois|portanto|logo|ent[ãa]o|por isso|because|therefore|since|thus|hence|so that)\b/gi;
const SOURCED = /\b(segundo|de acordo com|estudo|pesquisa|dados|according to|study|research|data|survey)\b/i;
const VALUE = /\b(acho|acredito|deveria|melhor|pior|i think|i believe|should|better|worse)\b/i;
const PREDICTION = /\b(vai|v[ãa]o|ir[áa]|will|going to)\b/i;

function findFallacies(text: string, locale: Locale): FallacyFlag[] {
  const parts = sentences(text);
  const flags: FallacyFlag[] = [];
  for (const rule of RULES) {
    const sentence = parts.find((part) => rule.pattern.test(part));
    if (!sentence) continue;
    // Prefer the clause that holds the match, so two flags in one sentence underline different words.
    const quote = clauses(sentence).find((part) => rule.pattern.test(part)) ?? sentence;
    flags.push({
      type: rule.type,
      quote,
      explanation: say(locale, rule.pt, rule.en),
      severity: rule.severity,
      confidence: 0.75 + (hash(quote + rule.type) % 20) / 100,
    });
    if (flags.length === 3) break;
  }
  return flags;
}

function findClaims(text: string): Claim[] {
  const claims: Claim[] = [];
  for (const quote of sentences(text)) {
    if (/\d/.test(quote)) claims.push({ quote, kind: "fact", checkworthy: true });
    else if (PREDICTION.test(quote)) claims.push({ quote, kind: "prediction", checkworthy: false });
    else if (VALUE.test(quote)) claims.push({ quote, kind: "value", checkworthy: false });
    if (claims.length === 4) break;
  }
  return claims;
}

/** How many longer words the message shares with the one it answers. */
function overlap(text: string, previous: string): number {
  const words = new Set(previous.toLowerCase().match(/[\p{L}]{5,}/gu) ?? []);
  return new Set((text.toLowerCase().match(/[\p{L}]{5,}/gu) ?? []).filter((word) => words.has(word))).size;
}

async function judgeMessage(input: JudgeInput): Promise<EngineResult<Judgement>> {
  await latency(input.text);
  const { text, locale } = input;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const parts = sentences(text);
  const jitter = hash(text);
  const connectives = (text.match(CONNECTIVES) ?? []).length;
  const fallacies = findFallacies(text, locale);
  const manipulation = MANIPULATION.test(text);

  const quality = {
    logic: clamp(3 + connectives * 1.5 + (words > 25 ? 1 : 0) + (jitter % 3)),
    evidence: clamp(2 + (/\d/.test(text) ? 3 : 0) + (SOURCED.test(text) ? 2 : 0) + ((jitter >> 3) % 3)),
    rebuttal: input.previous ? clamp(3 + overlap(text, input.previous.text) * 1.5 + ((jitter >> 6) % 3)) : 5,
    clarity: clamp(8 - (words / Math.max(1, parts.length) > 30 ? 2 : 0) - (words < 6 ? 3 : 0) + ((jitter >> 9) % 2)),
  };

  const note = manipulation
    ? say(locale, "Tentativa de instruir o juiz detectada por palavra-chave.", "Attempt to instruct the judge detected by keyword.")
    : say(
        locale,
        `Juiz de demonstração, sem IA: nota por palavras-chave (${fallacies.length} falácia(s) apontada(s)).`,
        `Demo judge, no AI: rating from keywords (${fallacies.length} fallacy flag(s)).`,
      );

  // The rolling "summary" is just the opening words of the latest messages.
  const head = text.trim().split(/\s+/).slice(0, 12).join(" ").replace(/[.,;:!?]+$/, "");
  const earlier = input.summary ? input.summary.split(" | ").slice(-5) : [];
  const summary = [...earlier, `${side(input.seat)}: ${head}${words > 12 ? "..." : ""}`].join(" | ");

  return result({ quality, fallacies, claims: findClaims(text), manipulation, note, summary });
}

const STATUSES: ValidationStatus[] = ["confirmed", "false", "imprecise", "unverifiable"];

const STATUS_TEXT: Record<ValidationStatus, { pt: string; en: string }> = {
  confirmed: { pt: "A afirmação foi confirmada", en: "The claim was confirmed" },
  imprecise: { pt: "A afirmação é imprecisa", en: "The claim is imprecise" },
  false: { pt: "A afirmação é falsa", en: "The claim is false" },
  unverifiable: { pt: "Não foi possível verificar a afirmação", en: "The claim could not be verified" },
};

const mockSources = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    title: `Mock source ${index + 1} (no API key)`,
    url: `https://example.com/mock-source-${index + 1}`,
  }));

function pickIntent(input: MentionInput, body: string): MentionIntent {
  if (/\b(pontos?|nota|placar|perdi|ganhei|points?|score|scoring)\b/i.test(body)) return "explain";
  if (input.replyTo || /\b(verdade|verdadeiro|fato|checa|confere|procede|true|fact|check|right)\b/i.test(body)) return "validate";
  if (body.split(/\s+/).filter(Boolean).length < 2) return "off_topic";
  return "search";
}

async function answerMention(input: MentionInput): Promise<EngineResult<BotReply>> {
  await latency(input.text);
  const { locale } = input;
  const body = input.text.replace(new RegExp(`@${BRAND.bot.handle}\\b`, "gi"), "").trim();
  let intent = pickIntent(input, body);
  const empty = { sources: [], ruling: null };

  // Without a target there is nothing to rule on: treat it as a plain search.
  const opponent = [...input.recent].reverse().find((line) => line.seat !== input.seat);
  const target: TranscriptLine | undefined = input.replyTo ?? opponent ?? input.recent.at(-1);
  if (intent === "validate" && !target) intent = "search";

  if ((intent === "validate" || intent === "search") && !input.canSearch) {
    return result({
      intent: "off_topic",
      text: say(locale, "Suas chamadas da @deb acabaram, então não posso pesquisar na web.", "Your @deb calls are used up, so I cannot search the web."),
      ...empty,
    });
  }

  if (intent === "explain") {
    const last = input.scoreboard.split("\n").slice(-3).join(" ");
    return result({
      intent,
      text: say(locale, `Explicação de demonstração a partir do placar: ${last}`, `Demo explanation from the scoreboard: ${last}`),
      ...empty,
    });
  }

  if (intent === "off_topic") {
    return result({
      intent,
      text: say(locale, "Isso não tem relação com o debate.", "That is not related to the debate."),
      ...empty,
    });
  }

  if (intent === "search") {
    return result({
      intent,
      text: say(
        locale,
        `Resultado de demonstração para "${body}". Sem chave da Groq não há pesquisa de verdade.`,
        `Demo result for "${body}". Without a Groq key there is no real search.`,
      ),
      sources: mockSources(2),
      ruling: null,
    });
  }

  const parts = sentences(target!.text);
  const claimQuote = parts.find((part) => /\d/.test(part)) ?? parts[0] ?? target!.text;
  const status = STATUSES[hash(target!.text) % STATUSES.length];
  return result({
    intent,
    text: say(
      locale,
      `${STATUS_TEXT[status].pt} (resultado sorteado pelo texto, sem pesquisa de verdade).`,
      `${STATUS_TEXT[status].en} (outcome drawn from the text, no real search).`,
    ),
    sources: status === "unverifiable" ? [] : mockSources(2),
    ruling: { targetMessageId: target!.id, claimQuote, status },
  });
}

async function writeRuling(input: RulingInput): Promise<EngineResult<Ruling>> {
  await latency(input.motion + input.transcript.length);
  const { locale, winner } = input;
  const best = (seat: Seat) => {
    const longest = input.transcript.filter((line) => line.seat === seat).sort((x, y) => y.text.length - x.text.length)[0];
    return longest ? (sentences(longest.text)[0] ?? null) : null;
  };
  const outcome =
    winner === "draw"
      ? say(locale, "O debate terminou empatado.", "The debate ended in a draw.")
      : say(locale, `O lado "${input.stances[winner]}" argumentou melhor.`, `The "${input.stances[winner]}" side argued better.`);
  const advice = say(
    locale,
    "Sustente cada afirmação com um dado e responda ao último ponto do adversário.",
    "Back each claim with a figure and answer the opponent's last point.",
  );
  return result({
    text: `${outcome} ${locale === "pt" ? `Pontos: ${input.stances.a} ${input.totals.a}, ${input.stances.b} ${input.totals.b}. Veredito de demonstração, sem IA.` : `Points: ${input.stances.a} ${input.totals.a}, ${input.stances.b} ${input.totals.b}. Demo ruling, no AI.`}`,
    best: { a: best("a"), b: best("b") },
    advice: { a: advice, b: advice },
  });
}

export const mockEngine: JudgeEngine = { judgeMessage, answerMention, writeRuling };
