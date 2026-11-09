import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { buildBankTree, withQuestions } from "@/lib/bank-tree";
import { listPublishedCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { listNotices } from "@/server/notices";
import { bankCounts } from "@/server/questions";
import { resolveHandle } from "@/server/teachers";

// A teacher's site reflects edits immediately, so none of it is prerendered: each loader starts
// with `connection()`, which stops Next from trying to build these pages ahead of a request.
// Each runs once per request however many components ask.

/** The owner of lecturer.bd/<handle>. */
export const getSite = cache(async (handle: string) => {
  await connection();
  return resolveHandle(await getDb(), handle);
});

/** The teacher's published courses, in order, with their chapters. */
export const getSiteCourses = cache(async (teacherId: string) => {
  await connection();
  return listPublishedCourses(await getDb(), teacherId);
});

/**
 * The website's question bank: the classes › subjects › chapters of published courses that have
 * public questions, with each section's count.
 */
export const getSiteBank = cache(async (teacherId: string) => {
  await connection();
  const [courses, counts] = await Promise.all([
    getSiteCourses(teacherId),
    bankCounts(await getDb(), teacherId, { publicOnly: true }),
  ]);
  return withQuestions(buildBankTree(courses, counts));
});

/** The teacher's notices, pinned first then newest; all of them when no limit is given. */
export const getSiteNotices = cache(async (teacherId: string, limit?: number) => {
  await connection();
  return listNotices(await getDb(), teacherId, limit);
});
