// The data model from qbank-handoff/HANDOFF.md, plus a few optional display fields
// (marked "extra") that the mockups need and the suggested model left out.

export type QType = "CQ" | "MCQ" | "SQ";
export type Difficulty = "easy" | "medium" | "hard";
/** extra: the colour family a class or subject is drawn in (blue, green, orange, purple). */
export type Tone = "blue" | "green" | "orange" | "purple";

export interface ClassLevel {
  /** "6", "9-10" */
  id: string;
  /** "Class 6", "SSC" */
  name: string;
  /** "Common", "Science", "Business Studies", "Humanities" */
  groups: string[];
  /** extra: the group tab a class page opens on */
  defaultGroup?: string;
  /** extra: the line under the class on the home page, e.g. "Junior" */
  tagline?: string;
  /** extra */
  tone?: Tone;
}

export interface Subject {
  /** `${classId}/${slug}`, e.g. "9-10/physics"; the slug is the URL segment */
  id: string;
  classId: string;
  group: string;
  nameEn: string;
  nameBn: string;
  abbr: string;
  /** extra */
  tone?: Tone;
  /** extra: shown instead of "N chapters", e.g. "Prose · Poetry · Drama" */
  blurb?: string;
}

export interface Chapter {
  /** `${subjectId}/${no}`, e.g. "9-10/physics/2" */
  id: string;
  subjectId: string;
  no: number;
  titleEn: string;
  titleBn: string;
}

export interface BoardTag {
  board: string;
  year: number;
}

export interface CqPart {
  key: "a" | "b" | "c" | "d";
  text: string;
  marks: number;
  level: string;
  answer: string;
}

export interface Question {
  id: string;
  chapterId: string;
  type: QType;
  difficulty?: Difficulty;
  /** empty = not a board question */
  boards: BoardTag[];
  /** extra: where a non-board question comes from, e.g. "Model test". No board and no source = practice. */
  source?: string;
  // CQ
  stem?: string;
  parts?: CqPart[];
  // MCQ (SQ uses `text` for the question too)
  text?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  // SQ
  /** extra: "Knowledge", "Comprehension" */
  level?: string;
  answer?: string;
}

/** Where a question in a list belongs, for lists that mix chapters. */
export interface QuestionPlace {
  href: string;
  label: string;
}
