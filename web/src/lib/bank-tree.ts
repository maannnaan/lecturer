import { BANK_TABS, type BankTab, type QuestionType, SECTION_TABS, tabOf } from "./questions";

/** How many questions each tab has: the five sections, and the board questions among them. */
export type TabCounts = Record<BankTab, number>;

/**
 * How many questions of one type a subject has in one chapter (`chapterId` null: in no chapter),
 * and whether they are board questions.
 */
export type CountRow = { subjectId: string; chapterId: string | null; type: QuestionType; board: boolean; n: number };

type SubjectLike = { id: string; classId: string; chapters: { id: string }[] };

export type BankChapter<S extends SubjectLike> = { chapter: S["chapters"][number]; counts: TabCounts; total: number };

export type BankSubject<S extends SubjectLike> = {
  subject: S;
  chapters: BankChapter<S>[];
  /** The subject's questions filed under no chapter. */
  unfiled: { counts: TabCounts; total: number };
  counts: TabCounts;
  total: number;
};

export type BankClassNode<C, S extends SubjectLike> = { bankClass: C; subjects: BankSubject<S>[]; counts: TabCounts; total: number };

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

/** The count rows by place: "<subject id>/<chapter id>", or "<subject id>/" for no chapter. */
function byPlace(rows: CountRow[]): Map<string, TabCounts> {
  const places = new Map<string, TabCounts>();
  for (const row of rows) {
    const key = `${row.subjectId}/${row.chapterId ?? ""}`;
    const counts = places.get(key) ?? emptyCounts();
    counts[tabOf(row.type)] += row.n;
    if (row.board) counts.board += row.n;
    places.set(key, counts);
  }
  return places;
}

function nodeOf<S extends SubjectLike>(subject: S, places: Map<string, TabCounts>): BankSubject<S> {
  const chapters = subject.chapters.map((chapter) => {
    const counts = places.get(`${subject.id}/${chapter.id}`) ?? emptyCounts();
    return { chapter, counts, total: totalOf(counts) };
  });
  const unfiled = places.get(`${subject.id}/`) ?? emptyCounts();
  const counts = emptyCounts();
  for (const chapter of chapters) addInto(counts, chapter.counts);
  addInto(counts, unfiled);
  return { subject, chapters, unfiled: { counts: unfiled, total: totalOf(unfiled) }, counts, total: totalOf(counts) };
}

/** One subject with each tab's question count, chapter by chapter, and in all. */
export function subjectNode<S extends SubjectLike>(subject: S, rows: CountRow[]): BankSubject<S> {
  return nodeOf(subject, byPlace(rows));
}

/**
 * The question bank the way it is browsed: classes (in the order given, empty ones too) ›
 * subjects (in the teacher's order) › chapters (in order, plus unfiled questions), with each tab's
 * question count at every level. Subjects of classes not given, and rows of subjects not given,
 * are left out.
 */
export function buildBankTree<C extends { id: string }, S extends SubjectLike>(classes: C[], subjects: S[], rows: CountRow[]): BankClassNode<C, S>[] {
  const places = byPlace(rows);
  return classes.map((bankClass) => {
    const inClass = subjects.filter((subject) => subject.classId === bankClass.id).map((subject) => nodeOf(subject, places));
    const counts = emptyCounts();
    for (const node of inClass) addInto(counts, node.counts);
    return { bankClass, subjects: inClass, counts, total: totalOf(counts) };
  });
}

/** Only the subjects that have questions, and the classes that still have one: the website's bank. */
export function withQuestions<C, S extends SubjectLike>(tree: BankClassNode<C, S>[]): BankClassNode<C, S>[] {
  return tree
    .map((node) => ({ ...node, subjects: node.subjects.filter((subject) => subject.total > 0) }))
    .filter((node) => node.subjects.length > 0);
}
