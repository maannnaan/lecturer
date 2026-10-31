// Creates the first platform admin, or resets the password of an existing one.
//
//   npm run seed:admin                       uses ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD
//   npm run seed:admin -- you@x.com secret   or pass the email and password directly
//
// With no DATABASE_URL this writes to the local embedded database, which only one process can
// open at a time: stop `npm run dev` first.
import { getDb } from "@/server/db";
import { upsertAdmin } from "@/server/admins";
import { PASSWORD_MIN } from "@/server/auth/password";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the environment
}

const [argEmail, argPassword] = process.argv.slice(2);
const email = argEmail ?? process.env.ADMIN_EMAIL;
const password = argPassword ?? process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || "Admin";

if (!email || !password) {
  console.error("Give an email and password: npm run seed:admin -- you@example.com your-password");
  process.exit(1);
}
if (password.length < PASSWORD_MIN) {
  console.error(`The password must be at least ${PASSWORD_MIN} characters.`);
  process.exit(1);
}

async function main(name: string, email: string, password: string) {
  const admin = await upsertAdmin(await getDb(), { name, email, password });
  console.log(`Admin ready: ${admin.email}`);
}

main(name, email, password).then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
