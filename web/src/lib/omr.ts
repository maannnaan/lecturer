// What an answer sheet says, kept the way the OMR Scanner app keeps it (MarkCodec in its
// omr/Model.kt), so a scanned sheet and one the teacher typed in are stored, and marked, alike.

/** The OMR Scanner app's newest release, as its GitHub release workflow publishes it. */
export const OMR_APP_URL = "https://github.com/maannnaan/OMR/releases/latest/download/omr-scanner.apk";

/** A question left empty. */
export const BLANK = -1;
/** A question with two or more bubbles filled. */
export const DOUBLE = -2;

/** The letters a sheet's options carry, in order. */
const LETTERS = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];

/**
 * What a sheet says on each question (an option's index, BLANK or DOUBLE), from the app's mark
 * string: one token per question, comma separated. "2" option 2 · "2e0" option 2, with a light
 * mark on 0 taken as erased · "2f" set by the teacher in review · "-" blank · "d1.3" two marks.
 * A token it can't read is a blank, as in the app.
 */
export function decodeMarks(text: string): number[] {
  if (!text.trim()) return [];
  return text.split(",").map((token) => {
    const t = token.trim();
    if (t.startsWith("d")) return DOUBLE;
    const core = (t.endsWith("f") ? t.slice(0, -1) : t).split("e")[0];
    return /^\d+$/.test(core) ? Number(core) : BLANK;
  });
}

/** The app's mark string for what a sheet says. */
export function encodeMarks(values: number[]): string {
  return values.map((v) => (v === BLANK ? "-" : v === DOUBLE ? "d" : String(v))).join(",");
}

export type SheetScore = { correct: number; wrong: number; blank: number; double: number; scoreHundredths: number };

/**
 * A sheet marked against its set's key: a mark for each right answer, less the negative mark for
 * each wrong one, two marks on a question counting as wrong (the board's rule); a blank costs
 * nothing. A question the key has no answer for is left out, and marks past the key are ignored.
 */
export function gradeSheet(values: number[], key: number[], marking: { markHundredths: number; negativeHundredths: number }): SheetScore {
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let double = 0;
  key.forEach((right, i) => {
    if (right < 0) return;
    const given = values[i] ?? BLANK;
    if (given === BLANK) blank++;
    else if (given === DOUBLE) double++;
    else if (given === right) correct++;
    else wrong++;
  });
  return { correct, wrong, blank, double, scoreHundredths: correct * marking.markHundredths - (wrong + double) * marking.negativeHundredths };
}

/**
 * A sheet's answers as the teacher types them, one character a question: ক খ গ ঘ (or a b c d),
 * "-" for a blank, "*" for two marks. Spaces and commas between them are ignored. Null when
 * anything else is in it, or an option the paper's questions don't have.
 */
export function parseAnswers(raw: string, optionCount = 4): number[] | null {
  const out: number[] = [];
  for (const ch of raw.normalize("NFC")) {
    if (/[\s,]/.test(ch)) continue;
    if (ch === "-" || ch === "_") {
      out.push(BLANK);
      continue;
    }
    if (ch === "*") {
      out.push(DOUBLE);
      continue;
    }
    let i = LETTERS.indexOf(ch);
    if (i < 0) i = "abcdef".indexOf(ch.toLowerCase());
    if (i < 0 || i >= optionCount) return null;
    out.push(i);
  }
  return out;
}

/** A sheet's answers the way the teacher would type them: "কখ-ঘ*". */
export function answersText(values: number[]): string {
  return values.map((v) => (v === BLANK ? "-" : v === DOUBLE ? "*" : (LETTERS[v] ?? "?"))).join("");
}
