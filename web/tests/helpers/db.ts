import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { registerTeacher, type NewTeacher, type Teacher } from "@/server/teachers";

/** A brand-new in-memory Postgres with every migration applied: the real schema, nothing shared. */
export async function freshDb(): Promise<Database> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db as unknown as Database;
}

/**
 * A brand-new in-memory Postgres with only the migrations before number `next` applied, to put
 * data in the old shape (with raw SQL: the schema in code is already the new one) and then test
 * migration `next` on it. `finish()` applies the rest.
 */
export async function dbBeforeMigration(next: number) {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
  const entries = journal.entries.filter((entry) => entry.idx < next);
  const dir = mkdtempSync(join(tmpdir(), "lecturer-migrations-"));
  mkdirSync(join(dir, "meta"));
  for (const entry of entries) copyFileSync(join("drizzle", `${entry.tag}.sql`), join(dir, `${entry.tag}.sql`));
  writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  const db = drizzle({ client: new PGlite(), schema });
  try {
    await migrate(db, { migrationsFolder: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { db: db as unknown as Database, finish: () => migrate(db, { migrationsFolder: "drizzle" }) };
}

let n = 0;

/** Registers a teacher with unique details; override whatever the test cares about. */
export async function makeTeacher(db: Database, overrides: Partial<NewTeacher> = {}): Promise<Teacher> {
  n += 1;
  return registerTeacher(db, {
    nameBn: `শিক্ষক ${n}`,
    nameEn: `Teacher ${n}`,
    phone: `0171${String(1000000 + n).slice(-7)}`,
    email: null,
    handle: `teacher-${n}`,
    subjects: "",
    institution: "",
    password: "correct horse battery",
    ...overrides,
  });
}
