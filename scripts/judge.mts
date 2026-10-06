// One judgement in the terminal: `pnpm judge '<message>' [--locale en|pt]`.
// Uses Groq when GROQ_API_KEY is set in .env.local, the mock otherwise.
import { engineInfo, getEngine } from "@/judge";
import { normalizeJudgement, scoreMessage } from "@/lib/debate/scoring";
import { parseArgs, printUsage, sampleContext, samplePrevious } from "./sample.mjs";

const { locale, text } = parseArgs(process.argv);
if (!text) {
  console.error("usage: pnpm judge '<message>' [--locale en|pt]");
  process.exit(1);
}

const info = engineInfo();
console.log(`engine: ${info.kind}${info.reason ? ` (${info.reason})` : ""} · model: ${info.models.judge} · locale: ${locale}\n`);

const started = Date.now();
const { value } = await getEngine().judgeMessage({
  ...sampleContext(locale),
  seat: "b",
  round: 1,
  isOpening: false,
  text,
  previous: { seat: "a", text: samplePrevious(locale) },
  summary: "",
});
const judgement = normalizeJudgement(value);
const score = scoreMessage(text, judgement, false);

console.log(JSON.stringify(judgement, null, 2));
console.log(`\nscore: ${score.points} = base ${score.base} - penalties ${score.penalty}${score.manipulation ? " (manipulation: 0)" : ""}`);
console.log(`counted fallacies: ${score.penalties.map((p) => `${p.type} -${p.points}`).join(", ") || "none"}`);
console.log(`time: ${Date.now() - started} ms`);
await printUsage();
