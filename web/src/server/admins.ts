import { eq, getTableColumns } from "drizzle-orm";
import type { Database } from "@/server/db";
import { admins } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

type AdminRow = typeof admins.$inferSelect;
export type Admin = Omit<AdminRow, "passwordHash">;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { passwordHash: _passwordHash, ...adminColumns } = getTableColumns(admins);

/** Adds a platform admin, or resets the name and password of the one with this email. */
export async function upsertAdmin(
  db: Database,
  input: { name: string; email: string; password: string },
): Promise<Admin> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(admins)
    .values({ name: input.name.trim(), email, passwordHash })
    .onConflictDoUpdate({ target: admins.email, set: { name: input.name.trim(), passwordHash } })
    .returning(adminColumns);
  return row;
}

export async function findAdminForLogin(db: Database, email: string): Promise<AdminRow | null> {
  const [row] = await db.select().from(admins).where(eq(admins.email, email.trim().toLowerCase())).limit(1);
  return row ?? null;
}

export async function findAdminById(db: Database, id: string): Promise<Admin | null> {
  const [row] = await db.select(adminColumns).from(admins).where(eq(admins.id, id)).limit(1);
  return row ?? null;
}
