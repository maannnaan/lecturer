import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { notices } from "@/server/db/schema";
import type { parseNotice } from "@/lib/courses";
import { isUuid } from "@/lib/ids";

export type Notice = typeof notices.$inferSelect;
export type NoticeInput = ReturnType<typeof parseNotice>["notice"];

/** A teacher's notices, pinned first, then newest first. */
export async function listNotices(db: Database, teacherId: string, limit?: number): Promise<Notice[]> {
  const query = db
    .select()
    .from(notices)
    .where(eq(notices.teacherId, teacherId))
    .orderBy(desc(notices.pinned), desc(notices.publishedAt));
  return limit ? query.limit(limit) : query;
}

export async function createNotice(db: Database, teacherId: string, input: NoticeInput): Promise<Notice> {
  const [row] = await db
    .insert(notices)
    .values({ ...input, teacherId })
    .returning();
  return row;
}

export async function updateNotice(
  db: Database,
  teacherId: string,
  noticeId: string,
  input: NoticeInput,
): Promise<Notice | null> {
  if (!isUuid(noticeId)) return null;
  const [row] = await db
    .update(notices)
    .set(input)
    .where(and(eq(notices.id, noticeId), eq(notices.teacherId, teacherId)))
    .returning();
  return row ?? null;
}

export async function deleteNotice(db: Database, teacherId: string, noticeId: string): Promise<boolean> {
  if (!isUuid(noticeId)) return false;
  const gone = await db
    .delete(notices)
    .where(and(eq(notices.id, noticeId), eq(notices.teacherId, teacherId)))
    .returning({ id: notices.id });
  return gone.length > 0;
}
