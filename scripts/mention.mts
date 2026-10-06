// One @mention in the terminal: `pnpm mention '<question>' [--locale en|pt]`.
// Add --reply to send it as a reply to the sample opponent message (a validation).
import { engineInfo, getEngine } from "@/judge";
import { MENTION } from "@/lib/brand";
import { normalizeReply } from "@/lib/debate/scoring";
import { parseArgs, printUsage, sampleContext, samplePrevious } from "./sample.mjs";

const reply = process.argv.includes("--reply");
const { locale, text } = parseArgs(process.argv.filter((arg) => arg !== "--reply"));
if (!text) {
  console.error("usage: pnpm mention '<question>' [--locale en|pt] [--reply]");
  process.exit(1);
}

const info = engineInfo();
console.log(`engine: ${info.kind}${info.reason ? ` (${info.reason})` : ""} · model: ${info.models.mention} · locale: ${locale}\n`);

const opponent = { id: "sample-1", seat: "a" as const, round: 1, text: samplePrevious(locale) };
const started = Date.now();
const { value } = await getEngine().answerMention({
  ...sampleContext(locale),
  seat: "b",
  text: text.toLowerCase().includes(MENTION) ? text : `${MENTION} ${text}`,
  replyTo: reply ? opponent : null,
  recent: [opponent],
  summary: "",
  scoreboard: "m1 (side A, round 1): 68 points = base 68 - penalties 0\ntotals: side A 68, side B 0; meter: A 59%, B 41%",
  canSearch: true,
});

console.log(JSON.stringify(normalizeReply(value, new Set([opponent.id]), reply ? opponent.id : null), null, 2));
console.log(`\ntime: ${Date.now() - started} ms`);
await printUsage();
