import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { subjectNode } from "@/lib/bank-tree";
import { getSubjectByNumber } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { getSite, getSiteClasses } from "../../../data";

/**
 * The bank subject behind lecturer.bd/<handle>/bank/<class>/<number>, with its class, its chapters
 * and each section's count of public questions. Null when there's no such subject in that class
 * (proxy.ts has already sent a subject asked for under another class to its own).
 */
export const getPageSubject = cache(async (handle: string, classNo: string, number: string) => {
  await connection();
  const site = await getSite(handle.toLowerCase());
  if (!site || !/^\d{1,6}$/.test(classNo) || !/^\d{1,6}$/.test(number)) return null;
  const db = await getDb();
  const subject = await getSubjectByNumber(db, site.teacher.id, Number(number));
  if (!subject) return null;
  const bankClass = (await getSiteClasses(site.teacher.id)).find((c) => c.id === subject.classId);
  if (!bankClass || bankClass.number !== Number(classNo)) return null;
  const counts = await bankCounts(db, site.teacher.id, { publicOnly: true });
  return { teacher: site.teacher, bankClass, node: subjectNode(subject, counts) };
});
