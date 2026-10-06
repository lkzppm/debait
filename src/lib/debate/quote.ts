/**
 * Locating a model's "verbatim" quote inside the message it came from.
 * Models change case, curly quotes and whitespace, so the match ignores those
 * while still returning positions in the original text (for the underline).
 */

function fold(char: string): string {
  if (char === "“" || char === "”" || char === "«" || char === "»") return '"';
  if (char === "‘" || char === "’") return "'";
  return char.toLowerCase();
}

/** Folds case and quotes, collapses whitespace; `map[i]` is the original index of folded char `i`. */
function normalize(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/\s/.test(char)) {
      pendingSpace = folded.length > 0;
      continue;
    }
    if (pendingSpace) {
      folded += " ";
      map.push(i - 1);
      pendingSpace = false;
    }
    folded += fold(char);
    map.push(i);
  }
  return { folded, map };
}

function trimQuote(quote: string): string {
  return quote
    .trim()
    .replace(/^["'“‘«]+|["'”’»]+$/g, "")
    .replace(/(\.\.\.|…)$/, "")
    .trim();
}

export interface Range {
  start: number;
  end: number;
}

/** Where `quote` sits in `text`, or null when the model did not quote the message. */
export function findQuote(text: string, quote: string): Range | null {
  const needle = normalize(trimQuote(quote)).folded;
  if (needle.length < 3) return null;
  const { folded, map } = normalize(text);
  const at = folded.indexOf(needle);
  if (at === -1) return null;
  return { start: map[at], end: map[at + needle.length - 1] + 1 };
}
