// Brings the production database (Neon, from DATABASE_URL) up to the latest migration in
// drizzle/, then makes sure the platform admin exists when ADMIN_EMAIL and ADMIN_PASSWORD are set.
// Runs before every Vercel build (see vercel.json); safe to repeat, since applied migrations are
// skipped and the admin is upserted.
//
//   npm run db:migrate
//
// Without a postgres:// DATABASE_URL there is nothing to do: the local embedded database
// migrates itself on first use.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { upsertAdmin } from "@/server/admins";
import { PASSWORD_MIN } from "@/server/auth/password";
import type { Database } from "@/server/db";
import * as schema from "@/server/db/schema";
import { databaseUrl } from "@/server/db/url";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the environment
}

async function main() {
  const url = databaseUrl();
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    if (process.env.VERCEL) {
      // Names only, never values: enough to spot a prefixed or misnamed variable.
      const near = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|^PG|NEON/i.test(k));
      console.error(`Database-like variables this build can see: ${near.length ? near.join(", ") : "none"}`);
      console.error(`Vercel environment: ${process.env.VERCEL_ENV ?? "unknown"}`);
      throw new Error(
        url
          ? `DATABASE_URL is set but doesn't start with postgres:// or postgresql:// (it starts with "${url.slice(0, 8)}…"). Paste only the connection string, without quotes or "psql".`
          : "Neither DATABASE_URL nor LECTURER_DATABASE_URL is set. Add your Neon connection string (postgres://…) in Vercel → Settings → Environment Variables, for this environment.",
      );
    }
    console.log("No DATABASE_URL: skipping (the local database migrates itself).");
    return;
  }

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle({ client: pool, schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Database migrations applied.");

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      if (password.length < PASSWORD_MIN) throw new Error(`ADMIN_PASSWORD must be at least ${PASSWORD_MIN} characters.`);
      const admin = await upsertAdmin(db as unknown as Database, {
        name: process.env.ADMIN_NAME || "Admin",
        email,
        password,
      });
      console.log(`Admin ready: ${admin.email}`);
    }
  } finally {
    await pool.end();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
