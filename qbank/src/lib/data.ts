import boardsJson from "@data/boards.json";
import chaptersJson from "@data/chapters.json";
import classesJson from "@data/classes.json";
import questionsJson from "@data/questions.json";
import subjectsJson from "@data/subjects.json";
import { classLabel } from "./format";
import { countByTab, matchesFilters, QTYPES, searchableText, type QuestionFilters, type TabKey } from "./questions";
import { questionHref } from "./routes";
import type { Chapter, ClassLevel, QType, Question, QuestionPlace, Subject } from "./types";

/* The sample data in /data, checked once when the server loads it, with lookups for the pages.
   Only server components import this file; client components get what they need as props. */

const classes = classesJson as ClassLevel[];
const subjects = subjectsJson as Subject[];
const chapters = (chaptersJson as Chapter[]).slice().sort((a, b) => a.no - b.no);
const questions = questionsJson as unknown as Question[];
const boardNames: string[] = boardsJson.boards;
const listedYears: number[] = boardsJson.years.slice().sort((a, b) => b - a);

const classById = new Map(classes.map((c) => [c.id, c]));
const subjectById = new Map(subjects.map((s) => [s.id, s]));
const chapterById = new Map(chapters.map((c) => [c.id, c]));

validate();

function validate() {
  const problems: string[] = [];
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${label} id "${id}" is used twice`);
      seen.add(id);
    }
  };
  unique("class", classes.map((c) => c.id));
  unique("subject", subjects.map((s) => s.id));
  unique("chapter", chapters.map((c) => c.id));
  unique("question", questions.map((q) => q.id));

  for (const c of classes) {
    if (c.groups.length === 0) problems.push(`class ${c.id} has no groups`);
    if (c.defaultGroup && !c.groups.includes(c.defaultGroup)) problems.push(`class ${c.id}: unknown defaultGroup`);
  }
  for (const s of subjects) {
    const cls = classById.get(s.classId);
    if (!cls) problems.push(`subject ${s.id}: unknown class ${s.classId}`);
    else if (!cls.groups.includes(s.group)) problems.push(`subject ${s.id}: class ${s.classId} has no group "${s.group}"`);
    if (!s.id.startsWith(`${s.classId}/`)) problems.push(`subject ${s.id}: id must start with "${s.classId}/"`);
  }
  for (const ch of chapters) {
    if (!subjectById.has(ch.subjectId)) problems.push(`chapter ${ch.id}: unknown subject ${ch.subjectId}`);
    if (ch.id !== `${ch.subjectId}/${ch.no}`) problems.push(`chapter ${ch.id}: id must be "${ch.subjectId}/${ch.no}"`);
  }
  for (const q of questions) {
    const where = `question ${q.id}`;
    if (!chapterById.has(q.chapterId)) problems.push(`${where}: unknown chapter ${q.chapterId}`);
    if (!QTYPES.includes(q.type)) problems.push(`${where}: unknown type ${q.type}`);
    if (!/^[A-Za-z0-9_-]+$/.test(q.id)) problems.push(`${where}: ids may only use letters, digits, - and _`);
    for (const tag of q.boards ?? []) {
      if (!boardNames.includes(tag.board)) problems.push(`${where}: unknown board ${tag.board}`);
      if (!Number.isInteger(tag.year)) problems.push(`${where}: board year must be a number`);
    }
    if (!Array.isArray(q.boards)) problems.push(`${where}: boards must be a list (empty for none)`);
    if (q.type === "CQ" && (!q.stem || !q.parts?.length)) problems.push(`${where}: a CQ needs a stem and parts`);
    if (q.type === "MCQ") {
      const n = q.options?.length ?? 0;
      if (!q.text || n < 2) problems.push(`${where}: an MCQ needs text and at least two options`);
      if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= n) {
        problems.push(`${where}: correctIndex must point at one of the options`);
      }
    }
    if (q.type === "SQ" && (!q.text || !q.answer)) problems.push(`${where}: an SQ needs text and an answer`);
  }
  if (problems.length > 0) throw new Error(`The sample data in /data has problems:\n- ${problems.join("\n- ")}`);
}

/* ── Lookups ───────────────────────────────────────────────────────────────────────────── */

export function allClasses(): ClassLevel[] {
  return classes;
}

export function getClass(id: string): ClassLevel | undefined {
  return classById.get(id);
}

export function subjectsOfClass(classId: string): Subject[] {
  return subjects.filter((s) => s.classId === classId);
}

export function allSubjects(): Subject[] {
  return subjects;
}

export function getSubject(classId: string, slug: string): Subject | undefined {
  return subjectById.get(`${classId}/${slug}`);
}

export function chaptersOfSubject(subjectId: string): Chapter[] {
  return chapters.filter((c) => c.subjectId === subjectId);
}

export function getChapter(subjectId: string, no: number): Chapter | undefined {
  return chapterById.get(`${subjectId}/${no}`);
}

export function questionsOfChapter(chapterId: string): Question[] {
  return questions.filter((q) => q.chapterId === chapterId);
}

export function chapterCounts(chapterId: string): Record<TabKey, number> {
  return countByTab(questionsOfChapter(chapterId));
}

export function classHasBoardQuestions(classId: string): boolean {
  return questions.some((q) => q.boards.length > 0 && q.chapterId.startsWith(`${classId}/`));
}

export function boards(): string[] {
  return boardNames;
}

/** The years the home page offers; "Older" means before the last of them. */
export function years(): number[] {
  return listedYears;
}

export function olderThan(): number {
  return Math.min(...listedYears);
}

/* ── The cross-chapter list (/questions) ──────────────────────────────────────────────── */

export interface QuestionSearch {
  q?: string;
  classId?: string;
  subjectId?: string;
  type?: QType | null;
  filters: QuestionFilters;
}

export interface PlacedQuestion {
  question: Question;
  place: QuestionPlace;
}

const classOrder = new Map(classes.map((c, i) => [c.id, i]));
const subjectOrder = new Map(subjects.map((s, i) => [s.id, i]));
const typeOrder = new Map(QTYPES.map((t, i) => [t, i]));
const questionOrder = new Map(questions.map((q, i) => [q.id, i]));

export function searchQuestions(search: QuestionSearch): PlacedQuestion[] {
  const terms = (search.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const older = olderThan();
  const found: Array<PlacedQuestion & { key: number[] }> = [];

  for (const q of questions) {
    const chapter = chapterById.get(q.chapterId)!;
    const subject = subjectById.get(chapter.subjectId)!;
    const cls = classById.get(subject.classId)!;
    if (search.classId && cls.id !== search.classId) continue;
    if (search.subjectId && subject.id !== search.subjectId) continue;
    if (search.type && q.type !== search.type) continue;
    if (!matchesFilters(q, search.filters, older)) continue;
    if (terms.length > 0) {
      // A term can match the question itself, or the chapter or subject it belongs to.
      const haystack = [
        searchableText(q),
        chapter.titleEn.toLowerCase(),
        chapter.titleBn,
        subject.nameEn.toLowerCase(),
        subject.nameBn,
      ].join(" ");
      if (!terms.every((t) => haystack.includes(t))) continue;
    }
    found.push({
      question: q,
      place: {
        href: questionHref(q),
        label: `${subject.nameEn} · ${classLabel(cls)} · Ch ${chapter.no} · ${chapter.titleEn}`,
      },
      key: [
        classOrder.get(cls.id)!,
        subjectOrder.get(subject.id)!,
        chapter.no,
        typeOrder.get(q.type)!,
        questionOrder.get(q.id)!,
      ],
    });
  }

  found.sort((a, b) => {
    for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i];
    return 0;
  });
  return found.map(({ question, place }) => ({ question, place }));
}
