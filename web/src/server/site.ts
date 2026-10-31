import { eq, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { type TeacherSite, teachers } from "@/server/db/schema";
import type { Locale } from "@/i18n";

/**
 * Merges `patch` into a teacher's website settings. Each top-level part (contact, stats,
 * routine…) is replaced as a whole; parts not in the patch are left as they were.
 */
export async function updateSite(db: Database, teacherId: string, patch: Partial<TeacherSite>): Promise<void> {
  await db
    .update(teachers)
    .set({ site: sql`${teachers.site} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(teachers.id, teacherId));
}

/** The profile section: names and subjects live on the account, the rest in the site settings. */
export async function updateProfile(
  db: Database,
  teacherId: string,
  account: { nameBn: string; nameEn: string; subjects: string; institution: string },
  sitePatch: Partial<TeacherSite>,
): Promise<void> {
  await db
    .update(teachers)
    .set({ ...account, site: sql`${teachers.site} || ${JSON.stringify(sitePatch)}::jsonb` })
    .where(eq(teachers.id, teacherId));
}

/** The language the teacher's website opens in for visitors who haven't chosen one. */
export async function setSiteLocale(db: Database, teacherId: string, locale: Locale): Promise<void> {
  await db.update(teachers).set({ locale }).where(eq(teachers.id, teacherId));
}
