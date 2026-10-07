// One judgement in the terminal: `pnpm judge '<message>' [--locale en|pt] [--level lenient|balanced|strict]`.
// Uses Groq when GROQ_API_KEY is set in .env.local, the mock otherwise.
import { engineInfo, getEngine } from "@/judge";
import { DEFAULT_STRICTNESS, normalizeJudgement, scoreMessage } from "@/lib/debate/scoring";
import { isStrictness } from "@/lib/debate/types";
import { parseArgs, printUsage, sampleContext, samplePrevious } from "./sample.mjs";

const levelAt = process.argv.indexOf("--level");
const level = levelAt === -1 ? undefined : process.argv[levelAt + 1];
const strictness = isStrictness(level) ? level : DEFAULT_STRICTNESS;
const { locale, text } = parseArgs(process.argv.filter((arg, index) => index !== levelAt && index !== levelAt + 1));
if (!text) {
  console.error("usage: pnpm judge '<message>' [--locale en|pt] [--level lenient|balanced|strict]");
  process.exit(1);
}

const info = engineInfo();
console.log(`engine: ${info.kind}${info.reason ? ` (${info.reason})` : ""} · model: ${info.models.judge} · locale: ${locale} · level: ${strictness}\n`);

const started = Date.now();
const { value } = await getEngine().judgeMessage({
  ...sampleContext(locale),
  strictness,
  seat: "b",
  round: 1,
  isOpening: false,
  text,
  previous: { seat: "a", text: samplePrevious(locale) },
  summary: "",
});
const judgement = normalizeJudgement(value);
const score = scoreMessage(text, judgement, false, strictness);

console.log(JSON.stringify(judgement, null, 2));
console.log(`\nscore: ${score.points} = base ${score.base} - penalties ${score.penalty}${score.manipulation ? " (manipulation: 0)" : ""}`);
console.log(`counted fallacies: ${score.penalties.map((p) => `${p.type} -${p.points}`).join(", ") || "none"}`);
console.log(`time: ${Date.now() - started} ms`);
await printUsage();
