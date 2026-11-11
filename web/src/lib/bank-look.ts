import type { Grade } from "./grades";

// How the question bank's classes and subjects are drawn (the QBank design): each class has a big
// number and a colour, each subject a coloured square with its abbreviation. Teachers name their
// own subjects, so the abbreviation and colour are worked out from the name and its place.

export type Tone = "blue" | "green" | "orange" | "purple" | "gray";

const SUBJECT_TONES: Tone[] = ["blue", "green", "orange", "purple"];

/** A subject's colour: blue, green, orange, purple in turn, by its place in the class. */
export function subjectTone(index: number): Tone {
  return SUBJECT_TONES[((index % SUBJECT_TONES.length) + SUBJECT_TONES.length) % SUBJECT_TONES.length];
}

const graphemes = (text: string): string[] => {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  return Segmenter ? [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment) : [...text];
};

// "১ম পত্র", "2nd Paper": the paper number, in the script it was written in. "য়" is written either
// as one character (U+09DF) or as য + nukta, so both spellings of ২য় count.
const PAPER = /(?:^|\s)(1st|2nd|১ম|২(?:য়|য়))(?=\s|$)/iu;
const paperDigit = (paper: string) =>
  paper.toLowerCase() === "1st" ? "1" : paper.toLowerCase() === "2nd" ? "2" : paper.charAt(0); // ১ or ২

/**
 * The subject's abbreviation for its square: "Ph" for Physics, "ICT" stays "ICT", "প" for
 * পদার্থবিজ্ঞান; a paper number is added, so "পদার্থবিজ্ঞান ১ম পত্র" is "প১" and "Physics 2nd Paper"
 * is "Ph2".
 */
export function subjectAbbr(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const paper = PAPER.exec(name)?.[1];
  const digit = paper ? paperDigit(paper) : "";
  let abbr: string;
  if (/^[A-Za-z]/.test(first)) {
    const letters = first.replace(/[^A-Za-z]/g, "");
    abbr = letters.length <= 4 && letters === letters.toUpperCase() ? letters : letters.slice(0, 2);
    abbr = abbr.charAt(0).toUpperCase() + abbr.slice(1);
  } else {
    abbr = graphemes(first)[0] ?? "";
  }
  return (abbr || "?") + digit;
}

/** The big number on a class card: "06", "09–10", "11–12"; null for classes that have none. */
export const GRADE_NUMBER: Record<Grade, number[] | null> = {
  "class-6": [6],
  "class-7": [7],
  "class-8": [8],
  ssc: [9, 10],
  hsc: [11, 12],
  admission: null,
  other: null,
};

/** The colour a class's number is drawn in, as in the design: junior orange, SSC green, HSC blue. */
export const GRADE_TONE: Record<Grade, Tone> = {
  "class-6": "orange",
  "class-7": "orange",
  "class-8": "orange",
  ssc: "green",
  hsc: "blue",
  admission: "purple",
  other: "gray",
};
