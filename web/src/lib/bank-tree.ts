import { GRADES, type Grade, gradeOf } from "./grades";
import { BANK_TABS, type BankTab, type QuestionType, tabOf } from "./questions";

/** How many questions each section has. */
export type TabCounts = Record<BankTab, number>;

/** How many questions of one type a course has in one chapter (`chapterId` null: in no chapter). */
export type CountRow = { courseId: string; chapterId: string | null; type: QuestionType; n: number };

type CourseLike = { id: string; grade: string; chapters: { id: string }[] };

export type BankChapter<C extends CourseLike> = { chapter: C["chapters"][number]; counts: TabCounts; total: number };

export type BankCourse<C extends CourseLike> = {
  course: C;
  chapters: BankChapter<C>[];
  /** The course's questions filed under no chapter. */
  unfiled: { counts: TabCounts; total: number };
  counts: TabCounts;
  total: number;
};

export type BankGrade<C extends CourseLike> = { grade: Grade; courses: BankCourse<C>[]; counts: TabCounts; total: number };

export function emptyCounts(): TabCounts {
  return { textbook: 0, practice: 0, mcq: 0, sq: 0, cq: 0 };
}

export function totalOf(counts: TabCounts): number {
  return BANK_TABS.reduce((sum, tab) => sum + counts[tab], 0);
}

function addInto(into: TabCounts, from: TabCounts) {
  for (const tab of BANK_TABS) into[tab] += from[tab];
}

/**
 * The question bank the way it is browsed: classes (in GRADES order, only those that have courses)
 * › courses, the subjects (in the teacher's order) › chapters (in order, plus unfiled questions),
 * with each section's question count at every level. Rows for courses not given are ignored.
 */
export function buildBankTree<C extends CourseLike>(courses: C[], rows: CountRow[]): BankGrade<C>[] {
  const byPlace = new Map<string, TabCounts>();
  for (const row of rows) {
    const key = `${row.courseId}/${row.chapterId ?? ""}`;
    const counts = byPlace.get(key) ?? emptyCounts();
    counts[tabOf(row.type)] += row.n;
    byPlace.set(key, counts);
  }

  const grades = new Map<Grade, BankGrade<C>>();
  for (const course of courses) {
    const chapters = course.chapters.map((chapter) => {
      const counts = byPlace.get(`${course.id}/${chapter.id}`) ?? emptyCounts();
      return { chapter, counts, total: totalOf(counts) };
    });
    const unfiled = byPlace.get(`${course.id}/`) ?? emptyCounts();
    const counts = emptyCounts();
    for (const chapter of chapters) addInto(counts, chapter.counts);
    addInto(counts, unfiled);

    const grade = gradeOf(course);
    const group = grades.get(grade) ?? { grade, courses: [], counts: emptyCounts(), total: 0 };
    group.courses.push({ course, chapters, unfiled: { counts: unfiled, total: totalOf(unfiled) }, counts, total: totalOf(counts) });
    addInto(group.counts, counts);
    group.total = totalOf(group.counts);
    grades.set(grade, group);
  }
  return GRADES.flatMap((grade) => grades.get(grade) ?? []);
}

/** Only the courses that have questions, and the classes that still have a course: the website's bank. */
export function withQuestions<C extends CourseLike>(tree: BankGrade<C>[]): BankGrade<C>[] {
  return tree
    .map((grade) => ({ ...grade, courses: grade.courses.filter((course) => course.total > 0) }))
    .filter((grade) => grade.courses.length > 0);
}
