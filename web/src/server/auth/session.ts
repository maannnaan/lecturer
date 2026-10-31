import { eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { hashToken, newToken } from "./tokens";

/** A session lasts this long after it was last used. */
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export type Principal =
  | { kind: "admin"; adminId: string }
  | { kind: "teacher"; teacherId: string }
  | { kind: "student"; teacherId: string; studentId: string };

/** What a cookie must turn out to be. A student session is only ever valid on its own teacher's site. */
export type SessionExpectation = { kind: "admin" } | { kind: "teacher" } | { kind: "student"; teacherId: string };

export type SessionRow = typeof sessions.$inferSelect;

/** Starts a session and returns the token for the cookie. Only the token's hash is stored. */
export async function createSession(db: Database, who: Principal, userAgent = ""): Promise<string> {
  const token = newToken();
  const now = Date.now();
  await db.insert(sessions).values({
    id: hashToken(token),
    kind: who.kind,
    adminId: who.kind === "admin" ? who.adminId : null,
    teacherId: who.kind === "admin" ? null : who.teacherId,
    studentId: who.kind === "student" ? who.studentId : null,
    userAgent: userAgent.slice(0, 300),
    lastSeenAt: new Date(now),
    expiresAt: new Date(now + SESSION_DAYS * DAY_MS),
  });
  return token;
}

/**
 * The live session behind a cookie token, or null when there is none, it has expired, or it is
 * not the expected kind of account (a student session for another teacher's site counts as none).
 * A session in use is extended, at most once a day so reads don't turn into writes.
 */
export async function validateSession(
  db: Database,
  token: string | undefined,
  expect: SessionExpectation,
): Promise<SessionRow | null> {
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!row || row.kind !== expect.kind) return null;
  if (expect.kind === "student" && row.teacherId !== expect.teacherId) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now - row.lastSeenAt.getTime() > DAY_MS) {
    const lastSeenAt = new Date(now);
    const expiresAt = new Date(now + SESSION_DAYS * DAY_MS);
    await db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.id, id));
    return { ...row, lastSeenAt, expiresAt };
  }
  return row;
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
