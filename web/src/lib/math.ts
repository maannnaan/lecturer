/**
 * Splits question text into plain text and maths, the way teachers write it:
 *   $F = ma$        inline maths
 *   $$a = F/m$$     maths on its own line
 *   \$              a literal dollar sign
 * A `$` with no closing partner stays plain text, and inline maths never runs across a blank
 * line, so a stray dollar can't swallow the rest of a question. Rendering happens elsewhere
 * (KaTeX on the server for students, in the browser for the editor's preview).
 */
export type MathSegment = { kind: "text"; value: string } | { kind: "inline" | "display"; tex: string };

export function splitMath(source: string): MathSegment[] {
  const out: MathSegment[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ kind: "text", value: text });
    text = "";
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\" && source[i + 1] === "$") {
      text += "$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = source[i + 1] === "$";
      const width = display ? 2 : 1;
      const close = closingDollar(source, i + width, display);
      if (close > i + width) {
        flush();
        out.push({ kind: display ? "display" : "inline", tex: source.slice(i + width, close).trim() });
        i = close + width;
        continue;
      }
      // No partner (or nothing between the two): keep the dollar signs as written.
      text += source.slice(i, i + width);
      i += width;
      continue;
    }
    text += ch;
    i += 1;
  }
  flush();
  return out;
}

/** Where the maths opened just before `from` closes, or -1. Escaped characters are skipped. */
function closingDollar(source: string, from: number, display: boolean): number {
  for (let j = from; j < source.length; j++) {
    const ch = source[j];
    if (ch === "\\") {
      j += 1;
      continue;
    }
    if (ch === "$") {
      if (!display) return j;
      if (source[j + 1] === "$") return j;
    }
    if (!display && ch === "\n" && source[j + 1] === "\n") return -1;
  }
  return -1;
}

/** True when the text contains any maths, so pages can skip KaTeX work for plain questions. */
export function hasMath(source: string): boolean {
  return splitMath(source).some((s) => s.kind !== "text");
}
