import { type SQL, and, desc, eq, isNotNull } from "drizzle-orm";
import { asciiDigits } from "@/lib/digits";
import { isUuid } from "@/lib/ids";
import { paperCode, setCodes } from "@/lib/papers";
import { OPTION_COUNT } from "@/lib/questions";
import { ROLL_MAX_DIGITS, parseRoll } from "@/lib/students";
import { validateSession } from "@/server/auth/session";
import type { Database } from "@/server/db";
import { courses, enrollments, paperQuestions, papers, students } from "@/server/db/schema";
import { type Sheet, saveResults } from "./paper-results";
import { type Paper, getPaper, paperKeys } from "./papers";
import { type Teacher, findTeacherById } from "./teachers";

// What the OMR Scanner app (github.com/maannnaan/OMR) reads and sends, in the JSON shapes its own
// models already have (PaperSummary and Paper in data/bank/QuestionBank.kt). The app signs in as
// the teacher, with an ordinary teacher session sent as a Bearer token; everything is the
// signed-in teacher's own, and every score is worked out here, never taken from the app.

/** The teacher a request's `Authorization: Bearer <token>` belongs to: a live teacher session, as the website's own. */
export async function teacherFromBearer(db: Database, authorization: string | null): Promise<Teacher | null> {
  const match = /^Bearer\s+([A-Za-z0-9_-]{16,200})$/.exec((authorization ?? "").trim());
  if (!match) return null;
  const session = await validateSession(db, match[1], { kind: "teacher" });
  return session?.teacherId ? findTeacherById(db, session.teacherId) : null;
}

/** A day as the app's English screens show it: "20 Nov 2026", in Bangladesh time. */
const dayOf = (date: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(date);

export type OmrPaperSummary = {
  id: string;
  title: string;
  code: string;
  subject: string;
  questions: number;
  options: number;
  setCount: number;
  firstSet: string;
  lastSet: string;
  author: string;
  updated: string;
};

/** How many MCQs each final paper of the teacher's has: only those with any can be scanned. */
async function finalPapers(db: Database, teacherId: string) {
  const rows = await db
    .select({ paper: papers, courseTitle: courses.title })
    .from(papers)
    .innerJoin(courses, eq(courses.id, papers.courseId))
    .where(and(eq(papers.teacherId, teacherId), eq(papers.status, "final")))
    .orderBy(desc(papers.finalizedAt), desc(papers.number));
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const mcqs = await db
      .select({ paperId: paperQuestions.paperId })
      .from(paperQuestions)
      .innerJoin(papers, eq(papers.id, paperQuestions.paperId))
      .where(and(eq(papers.teacherId, teacherId), eq(paperQuestions.section, "mcq"), isNotNull(paperQuestions.snapshot)));
    for (const row of mcqs) counts.set(row.paperId, (counts.get(row.paperId) ?? 0) + 1);
  }
  return rows.map((row) => ({ ...row, mcqCount: counts.get(row.paper.id) ?? 0 })).filter((row) => row.mcqCount > 0);
}

/** The teacher's final papers that have MCQs, newest first, matching `q` in their title, code or subject. */
export async function omrPaperList(db: Database, teacher: Teacher, q: string): Promise<OmrPaperSummary[]> {
  const needle = q.trim().toLowerCase();
  const author = teacher.nameEn || teacher.nameBn;
  return (await finalPapers(db, teacher.id))
    .map(({ paper, courseTitle, mcqCount }) => {
      const codes = setCodes(paper);
      return {
        id: paper.id,
        title: paper.title,
        code: paperCode(paper),
        subject: paper.header.subject || courseTitle,
        questions: mcqCount,
        options: OPTION_COUNT,
        setCount: codes.length,
        firstSet: String(codes[0]),
        lastSet: String(codes[codes.length - 1]),
        author,
        updated: dayOf(paper.finalizedAt ?? paper.updatedAt),
      };
    })
    .filter((p) => !needle || `${p.title} ${p.code} ${p.subject}`.toLowerCase().includes(needle))
    .slice(0, 100);
}

export type OmrPaper = {
  id: string;
  title: string;
  code: string;
  questions: number;
  options: number;
  /** Each set's key, by set code: the right option's place as that set prints it (0 = the first), -1 for none. */
  sets: Record<string, number[]>;
  /** How the app should lay out its answer sheet for this paper. */
  layout: { labels: "BANGLA" | "ABC"; language: "Bangla" | "English"; rollDigits: number; setCode: boolean; institution: string; examName: string };
  /** The paper's students, by roll as the sheet's roll grid reads it (padded to rollDigits). */
  students: { roll: string; name: string }[];
};

/** The active students a paper is for (its course, and its batch if it has one), with their rolls. */
async function paperStudents(db: Database, paper: Paper) {
  const conditions: SQL[] = [eq(enrollments.teacherId, paper.teacherId), eq(enrollments.courseId, paper.courseId), eq(enrollments.status, "active"), eq(students.status, "active"), isNotNull(enrollments.roll)];
  if (paper.batchId) conditions.push(eq(enrollments.batchId, paper.batchId));
  const rows = await db
    .select({ roll: enrollments.roll, name: students.name })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(...conditions));
  return rows.map((row) => ({ roll: row.roll!, name: row.name })).sort((a, b) => Number(a.roll) - Number(b.roll));
}

/** One final paper with MCQs, for the app to set up an exam from: every set's key, the sheet's layout and the students. */
export async function omrPaper(db: Database, teacher: Teacher, paperId: string): Promise<OmrPaper | "missing" | "notFinal"> {
  const paper = await getPaper(db, teacher.id, paperId);
  if (!paper) return "missing";
  if (paper.status !== "final") return "notFinal";
  const keys = await paperKeys(db, teacher.id, paper);
  const questions = keys.get(paper.firstSet)?.length ?? 0;
  if (questions === 0) return "missing";
  const people = await paperStudents(db, paper);
  // Room for the longest roll there is, and at least two digits so the next student fits too.
  const rollDigits = Math.min(ROLL_MAX_DIGITS, Math.max(2, ...people.map((p) => p.roll.length)));
  const bangla = teacher.locale !== "en";
  return {
    id: paper.id,
    title: paper.title,
    code: paperCode(paper),
    questions,
    options: OPTION_COUNT,
    sets: Object.fromEntries([...keys].map(([code, key]) => [String(code), key])),
    layout: {
      labels: bangla ? "BANGLA" : "ABC",
      language: bangla ? "Bangla" : "English",
      rollDigits,
      setCode: true,
      institution: paper.header.institution,
      examName: paper.title,
    },
    students: people.map((p) => ({ roll: p.roll.padStart(rollDigits, "0"), name: p.name })),
  };
}

/** The most sheets one upload may carry. */
export const MAX_UPLOAD = 500;
/** A sheet's marks as the app writes them: option numbers, "e" erased, "f" fixed, "d" two marks, "." between those, "-" blank, "," between questions. */
const MARKS = /^[0-9def.,-]{0,4000}$/;

export type OmrUploadResult = { saved: number; sheets: ({ roll: string; ok: true; name: string | null; score: number; total: number } | { roll: string; ok: false; error: "roll" | "set" | "marks" })[] };

/**
 * Answer sheets from the app for one final paper: `{ sheets: [{ roll, setCode, marks, scannedAt }] }`.
 * Each is checked on its own (a bad one is refused, the rest are saved) and marked here, against
 * its own set's key; a roll sent again replaces that roll's sheet. The teacher's written marks stay.
 */
export async function omrUpload(db: Database, teacher: Teacher, paperId: string, body: unknown): Promise<OmrUploadResult | "missing" | "notFinal" | "invalid"> {
  if (!isUuid(paperId)) return "missing";
  const list = (body as { sheets?: unknown } | null)?.sheets;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_UPLOAD) return "invalid";

  const answers: OmrUploadResult["sheets"] = [];
  const good: { at: number; sheet: Sheet }[] = [];
  for (const raw of list as Record<string, unknown>[]) {
    const sent = typeof raw?.roll === "string" || typeof raw?.roll === "number" ? String(raw.roll) : "";
    const errors = {};
    const roll = parseRoll(sent, errors);
    const setCode = Number(asciiDigits(String(raw?.setCode ?? "")).trim());
    const marks = typeof raw?.marks === "string" ? raw.marks.trim() : null;
    if (!roll) answers.push({ roll: sent, ok: false, error: "roll" });
    else if (!Number.isInteger(setCode)) answers.push({ roll: sent, ok: false, error: "set" });
    else if (marks === null || !MARKS.test(marks)) answers.push({ roll: sent, ok: false, error: "marks" });
    else {
      const when = typeof raw.scannedAt === "number" || typeof raw.scannedAt === "string" ? new Date(raw.scannedAt) : null;
      const scannedAt = when && !Number.isNaN(when.getTime()) && when.getFullYear() > 2000 ? when : new Date();
      good.push({ at: answers.length, sheet: { roll, setCode, marks, source: "scanner", scannedAt } });
      answers.push({ roll: sent, ok: false, error: "set" }); // replaced below once saved
    }
  }

  const done = await saveResults(db, teacher.id, paperId, good.map((g) => g.sheet));
  if (!done.ok) return done.reason;
  const total = ((await paperKeys(db, teacher.id, done.paper)).get(done.paper.firstSet)?.length ?? 0) * done.paper.markHundredths;
  let saved = 0;
  done.saved.forEach((result, i) => {
    const { at } = good[i];
    const roll = answers[at].roll;
    if (!result.ok) return; // a set the paper doesn't have: stays refused
    saved++;
    answers[at] = { roll, ok: true, name: result.name, score: result.result.scoreHundredths / 100, total: total / 100 };
  });
  return { saved, sheets: answers };
}
