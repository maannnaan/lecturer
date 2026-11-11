import { GRADES, type Grade, gradeOf } from "./grades";
import { BANK_TABS, type BankTab, type QuestionType, SECTION_TABS, tabOf } from "./questions";

/** How many questions each tab has: the five sections, and the board questions among them. */
export type TabCounts = Record<BankTab, number>;

/**
 * How many questions of one type a subject has in one chapter (`chapterId` null: in no chapter),
 * and whether they are board questions.
 */
export type CountRow = { subjectId: string; chapterId: string | null; type: QuestionType; board: boolean; n: number };

type SubjectLike = { id: string; grade: string; chapters: { id: string }[] };

export type BankChapter<S extends SubjectLike> = { chapter: S["chapters"][number]; counts: TabCounts; total: number };

export type BankSubject<S extends SubjectLike> = {
  subject: S;
  chapters: BankChapter<S>[];
  /** The subject's questions filed under no chapter. */
  unfiled: { counts: TabCounts; total: number };
  counts: TabCounts;
  total: number;
};

export type BankGrade<S extends SubjectLike> = { grade: Grade; subjects: BankSubject<S>[]; counts: TabCounts; total: number };

export function emptyCounts(): TabCounts {
  return { textbook: 0, practice: 0, mcq: 0, sq: 0, cq: 0, board: 0 };
}

/** How many questions there are in all: the sections' counts (board questions are in them too). */
export function totalOf(counts: TabCounts): number {
  return SECTION_TABS.reduce((sum, tab) => sum + counts[tab], 0);
}

function addInto(into: TabCounts, from: TabCounts) {
  for (const tab of BANK_TABS) into[tab] += from[tab];
}

/**
 * The question bank the way it is browsed: classes (in GRADES order, only those that have
 * subjects) › subjects (in the teacher's order) › chapters (in order, plus unfiled questions), with
 * each tab's question count at every level. Rows for subjects not given are ignored.
 */
export function buildBankTree<S extends SubjectLike>(subjects: S[], rows: CountRow[]): BankGrade<S>[] {
  const byPlace = new Map<string, TabCounts>();
  for (const row of rows) {
    const key = `${row.subjectId}/${row.chapterId ?? ""}`;
    const counts = byPlace.get(key) ?? emptyCounts();
    counts[tabOf(row.type)] += row.n;
    if (row.board) counts.board += row.n;
    byPlace.set(key, counts);
  }

  const grades = new Map<Grade, BankGrade<S>>();
  for (const subject of subjects) {
    const chapters = subject.chapters.map((chapter) => {
      const counts = byPlace.get(`${subject.id}/${chapter.id}`) ?? emptyCounts();
      return { chapter, counts, total: totalOf(counts) };
    });
    const unfiled = byPlace.get(`${subject.id}/`) ?? emptyCounts();
    const counts = emptyCounts();
    for (const chapter of chapters) addInto(counts, chapter.counts);
    addInto(counts, unfiled);

    const grade = gradeOf(subject);
    const group = grades.get(grade) ?? { grade, subjects: [], counts: emptyCounts(), total: 0 };
    group.subjects.push({ subject, chapters, unfiled: { counts: unfiled, total: totalOf(unfiled) }, counts, total: totalOf(counts) });
    addInto(group.counts, counts);
    group.total = totalOf(group.counts);
    grades.set(grade, group);
  }
  return GRADES.flatMap((grade) => grades.get(grade) ?? []);
}

/** Only the subjects that have questions, and the classes that still have one: the website's bank. */
export function withQuestions<S extends SubjectLike>(tree: BankGrade<S>[]): BankGrade<S>[] {
  return tree
    .map((grade) => ({ ...grade, subjects: grade.subjects.filter((subject) => subject.total > 0) }))
    .filter((grade) => grade.subjects.length > 0);
}
