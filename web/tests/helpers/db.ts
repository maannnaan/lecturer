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
