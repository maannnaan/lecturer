import { asciiDigits } from "./digits";
import type { Grade } from "./grades";

// How the question bank's classes and subjects are drawn (the QBank design): each class has a big
// number and a colour, each subject a coloured square with its abbreviation. Teachers name their
// own classes and subjects, so the numbers, abbreviations and colours are worked out from the
// names and their places.

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

/**
 * What a class's card shows, read from the name the teacher gave it: the class numbers ("দশম
 * শ্রেণি" 10, "এইচএসসি ২০২৬ ব্যাচ" 11–12, "Class 6" 6), or that it is for admission tests, or
 * neither. Also its colour (as in the design: junior orange, SSC green, HSC blue) and its rank in
 * the bank's order.
 */
export type ClassLook = { numbers: number[] | null; admission: boolean; tone: Tone; rank: number };

// Exams named after their classes, checked first: "এইচএসসি ভর্তি কোচিং" is still HSC.
const CLASS_EXAMS: [RegExp, number[]][] = [
  [/\bhsc\b|এইচএসসি|আলিম|\balim\b/iu, [11, 12]],
  [/\bssc\b|এসএসসি|দাখিল|\bdakhil\b/iu, [9, 10]],
  [/\b(?:jsc|jdc)\b|জেএসসি|জেডিসি/iu, [8]],
  [/\b(?:psc|pec)\b|পিএসসি|পিইসি/iu, [5]],
];
// Names are compared in NFC, where য় is always য + nukta, so the words are put in NFC too.
const ADMISSION = new RegExp(
  ["ভর্তি", "admission", "মেডিকেল", "medical", "ইঞ্জিনিয়ারিং", "engineering", "বিশ্ববিদ্যালয়", "university"].map((w) => w.normalize("NFC")).join("|"),
  "iu",
);
// Bangla ordinals, as in "নবম শ্রেণি" or "নবম-দশম".
const ORDINALS: [string, number][] = (
  [
    ["প্রথম", 1],
    ["দ্বিতীয়", 2],
    ["তৃতীয়", 3],
    ["চতুর্থ", 4],
    ["পঞ্চম", 5],
    ["ষষ্ঠ", 6],
    ["সপ্তম", 7],
    ["অষ্টম", 8],
    ["নবম", 9],
    ["দশম", 10],
    ["একাদশ", 11],
    ["দ্বাদশ", 12],
  ] as [string, number][]
).map(([word, n]) => [word.normalize("NFC"), n]);

/** At most two class numbers, in order: "নবম-দশম" is 9–10. */
const classNumbers = (found: number[]) => [...new Set(found)].slice(0, 2).sort((a, b) => a - b);

function toneOf(first: number): Tone {
  return first <= 5 ? "purple" : first <= 8 ? "orange" : first <= 10 ? "green" : "blue";
}

export function classLook(name: string): ClassLook {
  const text = name.normalize("NFC");
  let numbers: number[] | null = CLASS_EXAMS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  const admission = !numbers && ADMISSION.test(text);
  if (!numbers && !admission) {
    const ordinals = ORDINALS.flatMap(([word, n]) => (text.includes(word) ? [{ at: text.indexOf(word), n }] : []))
      .sort((a, b) => a.at - b.at)
      .map((o) => o.n);
    const digits = (asciiDigits(text).match(/\d+/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 12);
    const found = ordinals.length > 0 ? ordinals : digits;
    if (found.length > 0) numbers = classNumbers(found);
  }
  if (numbers) return { numbers, admission: false, tone: toneOf(numbers[0]), rank: numbers[0] };
  return admission ? { numbers: null, admission: true, tone: "purple", rank: 13 } : { numbers: null, admission: false, tone: "gray", rank: 14 };
}

/** The bank's order of classes: by the class each name reads as (৬ষ্ঠ before এসএসসি), then as added. */
export function sortClasses<T extends { name: string; position: number; number: number }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => classLook(a.name).rank - classLook(b.name).rank || a.position - b.position || a.number - b.number);
}

/** Which ready-made list of subject names suits a class: HSC's papers for "একাদশ শ্রেণি" and so on. */
export function classKey(name: string): Grade {
  const { numbers, admission } = classLook(name);
  if (admission) return "admission";
  if (!numbers) return "other";
  if (numbers.some((n) => n >= 11)) return "hsc";
  if (numbers.some((n) => n >= 9)) return "ssc";
  return numbers[0] === 8 ? "class-8" : numbers[0] === 7 ? "class-7" : numbers[0] === 6 ? "class-6" : "other";
}
