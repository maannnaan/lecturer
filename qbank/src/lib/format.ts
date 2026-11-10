import type { ClassLevel, QType, Subject, Tone } from "./types";

type ClassLike = Pick<ClassLevel, "id" | "name">;

/** "9-10" → "9–10" */
export function classRange(c: Pick<ClassLevel, "id">): string {
  return c.id.replace("-", "–");
}

/** The big number on a home-page class card: "06", "09–10". */
export function classNumber(c: Pick<ClassLevel, "id">): string {
  return c.id
    .split("-")
    .map((part) => part.padStart(2, "0"))
    .join("–");
}

/** "Class 6", "Class 9–10" */
export function classLabel(c: Pick<ClassLevel, "id">): string {
  return `Class ${classRange(c)}`;
}

/** "Class 6", "Class 9–10 (SSC)" */
export function classFullLabel(c: ClassLike): string {
  const label = classLabel(c);
  return c.name === label ? label : `${label} (${c.name})`;
}

/** "Class 6", "Class 9–10 · SSC" */
export function classTitle(c: ClassLike): string {
  const label = classLabel(c);
  return c.name === label ? label : `${label} · ${c.name}`;
}

/** The class switcher on a class page: "Class 6" … "9–10", "11–12". */
export function classTabLabel(c: Pick<ClassLevel, "id">): string {
  return c.id.includes("-") ? classRange(c) : classLabel(c);
}

/** "Science group"; a common subject is taken by every group. */
export function groupLabel(group: string): string {
  return group === "Common" ? "All groups" : `${group} group`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Full class strings, so Tailwind sees every one of them. */
export const TONE: Record<Tone, { box: string; text: string }> = {
  blue: { box: "bg-cq-soft text-cq", text: "text-cq" },
  green: { box: "bg-mcq-soft text-mcq", text: "text-mcq" },
  orange: { box: "bg-sq-soft text-sq", text: "text-sq" },
  purple: { box: "bg-purple-soft text-purple", text: "text-purple" },
};

export function toneOf(item: { tone?: Tone }): Tone {
  return item.tone ?? "green";
}

export const TYPE_META: Record<QType, { badge: string; tab: string; noun: string; nouns: string }> = {
  CQ: { badge: "bg-cq-soft text-cq", tab: "Creative (CQ)", noun: "creative question", nouns: "creative questions" },
  MCQ: { badge: "bg-mcq-soft text-mcq", tab: "MCQ", noun: "MCQ", nouns: "MCQs" },
  SQ: { badge: "bg-sq-soft text-sq", tab: "Short (SQ)", noun: "short question", nouns: "short questions" },
};

export function subjectMeta(subject: Pick<Subject, "blurb">, chapterCount: number): string {
  if (subject.blurb) return subject.blurb;
  return chapterCount > 0 ? plural(chapterCount, "chapter") : "Chapters coming soon";
}
