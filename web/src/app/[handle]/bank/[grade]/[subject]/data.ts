import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeOf, isGrade } from "@/lib/grades";
import { getSubjectByNumber } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { getSite } from "../../../data";

/**
 * The bank subject behind lecturer.bd/<handle>/bank/<class>/<number>, with its chapters and each
 * section's count of public questions. Null when there's no such subject in that class (proxy.ts
 * has already sent a subject asked for under the wrong class to the right one).
 */
export const getPageSubject = cache(async (handle: string, grade: string, number: string) => {
  await connection();
  const site = await getSite(handle.toLowerCase());
  if (!site || !isGrade(grade) || !/^\d{1,6}$/.test(number)) return null;
  const db = await getDb();
  const subject = await getSubjectByNumber(db, site.teacher.id, Number(number));
  if (!subject || gradeOf(subject) !== grade) return null;
  const counts = await bankCounts(db, site.teacher.id, { publicOnly: true });
  return { teacher: site.teacher, node: buildBankTree([subject], counts)[0].subjects[0] };
});
