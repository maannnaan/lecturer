import { type QuestionType, tabOf } from "@/lib/questions";

/** Where a question lives in the teacher's bank: its chapter's page, open on its section. */
export function bankHref(question: { subjectId: string; chapterId: string | null; type: QuestionType }): string {
  return `/dashboard/bank/subject/${question.subjectId}/${question.chapterId ?? "unfiled"}?tab=${tabOf(question.type)}`;
}
