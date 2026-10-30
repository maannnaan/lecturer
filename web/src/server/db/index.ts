import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

declare global {
  // Kept on globalThis so dev-server hot reloads reuse one connection instead of opening more.
  var __lecturerDb: Promise<Database> | undefined;
}

/**
 * The app's database. With a postgres:// DATABASE_URL (Neon in production) it is a pooled
 * serverless connection; without one it is an embedded Postgres (PGlite) stored in .data/,
 * migrated on first use, so local development needs no database server at all.
 */
export function getDb(): Promise<Database> {
  globalThis.__lecturerDb ??= connect().catch((err) => {
    globalThis.__lecturerDb = undefined;
    throw err;
  });
  return globalThis.__lecturerDb;
}

async function connect(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    return drizzleNeon({ client: new Pool({ connectionString: url }), schema }) as unknown as Database;
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const db = drizzlePglite({ client: new PGlite(dir), schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Database;
}

/**
 * The Postgres error behind a failed query, if it was a unique-constraint violation: the name of
 * the constraint that refused it. Drivers nest the original error differently, so walk the chain.
 */
export function uniqueViolation(err: unknown): string | null {
  for (let e = err as { code?: string; constraint?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === "23505") return e.constraint ?? "";
  }
  return null;
}
