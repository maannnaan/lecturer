import { and, eq, lt, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { rateLimits } from "@/server/db/schema";

/**
 * Counts one attempt against `key` in the current fixed window and says whether it is still
 * within `limit`. Stored in the database so the count holds across serverless instances.
 */
export async function takeAttempt(db: Database, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  // Earlier windows for this key can never count again.
  await db.delete(rateLimits).where(and(eq(rateLimits.key, key), lt(rateLimits.windowStart, windowStart)));
  return row.count <= limit;
}

/** Forgets the attempts against `key`, e.g. after a successful sign-in. */
export async function clearAttempts(db: Database, key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}
