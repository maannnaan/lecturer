import type { Database } from "@/server/db";

/** A transaction handle, as Drizzle passes it to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Rewrites positions 0…n-1 in the given order, touching only rows whose position changed. */
export async function renumber<T extends { id: string; position: number }>(
  db: Database,
  rows: T[],
  write: (tx: Tx, id: string, position: number) => Promise<unknown>,
) {
  await db.transaction(async (tx) => {
    for (const [position, row] of rows.entries()) if (row.position !== position) await write(tx, row.id, position);
  });
}

/**
 * The list with `id` swapped one place up or down; the same list when it is already at that end,
 * or null when `id` isn't in it at all.
 */
export function swapped<T extends { id: string }>(rows: T[], id: string, direction: "up" | "down"): T[] | null {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return rows;
  const next = rows.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
