import { DEFAULT_SOURCES, domId, SOURCE_KEYS, sourceOf, tabOfType } from "./questions";
import type { Chapter, Question, Subject } from "./types";

/* Ids are paths ("9-10/physics/2"), so every page's address is `/class/` + its id. */

export function classHref(classId: string): string {
  return `/class/${classId}`;
}

export function subjectHref(subject: Pick<Subject, "id">): string {
  return `/class/${subject.id}`;
}

/** The URL segment of a subject: "9-10/physics" → "physics". */
export function subjectSlug(subject: Pick<Subject, "id" | "classId">): string {
  return subject.id.slice(subject.classId.length + 1);
}

export function chapterHref(chapter: Pick<Chapter, "id">, query?: Record<string, string>): string {
  const qs = query ? new URLSearchParams(query).toString() : "";
  return `/class/${chapter.id}${qs ? `?${qs}` : ""}`;
}

/** A question inside its chapter: the right tab, and practice questions switched on if needed. */
export function questionHref(q: Question): string {
  const query: Record<string, string> = { type: tabOfType(q.type) };
  const source = sourceOf(q);
  if (!DEFAULT_SOURCES.includes(source)) {
    query.src = SOURCE_KEYS.filter((k) => k === source || DEFAULT_SOURCES.includes(k)).join(",");
  }
  return `${chapterHref({ id: q.chapterId }, query)}#${domId(q)}`;
}

export interface QuestionsQuery {
  q?: string;
  class?: string;
  subject?: string;
  type?: string;
  board?: string;
  year?: string;
}

/** The cross-chapter list: search results, board questions, a subject's mixed MCQs. */
export function questionsHref(query: QuestionsQuery = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const qs = params.toString();
  return `/questions${qs ? `?${qs}` : ""}`;
}
