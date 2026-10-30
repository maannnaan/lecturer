// Demo data for local development: an admin and three teachers, one per theme, plus an old
// address that redirects. Safe to run twice. Refuses to touch a real (postgres://) database.
//
//   npm run seed:demo        then  npm run dev
//
// Admin:    admin@lecturer.test / admin-password        (lecturer.bd/admin)
// Teachers: 01710000001…3       / teacher-password      (lecturer.bd/login)
import { getDb } from "@/server/db";
import { upsertAdmin } from "@/server/admins";
import type { ThemeName } from "@/lib/themes";
import {
  type TeacherStatus,
  changeHandle,
  findTeacherForLogin,
  registerTeacher,
  setTeacherStatus,
  setTeacherTheme,
} from "@/server/teachers";

const DEMO: {
  handle: string;
  /** Registered under this handle first, then moved to `handle`, so the old address redirects. */
  firstHandle?: string;
  nameBn: string;
  nameEn: string;
  phone: string;
  subjects: string;
  institution: string;
  theme: ThemeName;
  status: TeacherStatus;
}[] = [
  {
    handle: "tanvir",
    firstHandle: "tanvir-ahmed",
    nameBn: "তানভীর আহমেদ",
    nameEn: "Tanvir Ahmed",
    phone: "01710000001",
    subjects: "পদার্থবিজ্ঞান · উচ্চতর গণিত",
    institution: "মিরপুর-১০, ঢাকা",
    theme: "ink",
    status: "approved",
  },
  {
    handle: "nusrat",
    nameBn: "নুসরাত জাহান",
    nameEn: "Nusrat Jahan",
    phone: "01710000002",
    subjects: "রসায়ন",
    institution: "ধানমন্ডি, ঢাকা",
    theme: "mist",
    status: "approved",
  },
  {
    handle: "rafi",
    nameBn: "রাফি হাসান",
    nameEn: "Rafi Hasan",
    phone: "01710000003",
    subjects: "উচ্চতর গণিত",
    institution: "চট্টগ্রাম",
    theme: "sage",
    status: "pending",
  },
];

async function main() {
  const db = await getDb();
  await upsertAdmin(db, { name: "Demo Admin", email: "admin@lecturer.test", password: "admin-password" });

  for (const t of DEMO) {
    let teacher = await findTeacherForLogin(db, t.phone);
    if (!teacher) {
      const created = await registerTeacher(db, {
        nameBn: t.nameBn,
        nameEn: t.nameEn,
        phone: t.phone,
        email: null,
        handle: t.firstHandle ?? t.handle,
        subjects: t.subjects,
        institution: t.institution,
        password: "teacher-password",
      });
      if (t.firstHandle) await changeHandle(db, created.id, t.handle);
      teacher = await findTeacherForLogin(db, t.phone);
    }
    await setTeacherTheme(db, teacher!.id, t.theme);
    await setTeacherStatus(db, teacher!.id, t.status);
    console.log(`lecturer.bd/${t.handle}  (${t.theme}, ${t.status})`);
  }
  console.log("Admin: admin@lecturer.test / admin-password · Teachers: 01710000001…3 / teacher-password");
}

if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) {
  console.error("seed:demo only writes to the local embedded database. Unset DATABASE_URL.");
  process.exit(1);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
