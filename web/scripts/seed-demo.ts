// Demo data for local development: an admin and three teachers (one per theme) with filled-in
// websites, courses, lesson plans and notices, plus an old address that redirects. Safe to run
// twice. Refuses to touch a real (postgres://) database. All people and details are made up.
//
//   npm run seed:demo        then  npm run dev
//
// Admin:    admin@lecturer.test / admin-password        (lecturer.bd/admin)
// Teachers: 01710000001…3       / teacher-password      (lecturer.bd/login)
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { upsertAdmin } from "@/server/admins";
import { notices as noticesTable, type TeacherSite } from "@/server/db/schema";
import type { ThemeName } from "@/lib/themes";
import { addChapter, createCourse, listCourses } from "@/server/courses";
import { createNotice } from "@/server/notices";
import { updateSite } from "@/server/site";
import {
  type TeacherStatus,
  changeHandle,
  findTeacherForLogin,
  registerTeacher,
  setTeacherStatus,
  setTeacherTheme,
} from "@/server/teachers";

type DemoChapter = { title: string; status?: "done" | "ongoing" | "upcoming"; startsOn?: string; endsOn?: string };
type DemoCourse = {
  title: string;
  level: string;
  session?: string;
  description?: string;
  icon: string;
  cover: number;
  access: "free" | "approval" | "paid";
  price?: number;
  chapters: (string | DemoChapter)[];
};

type DemoTeacher = {
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
  site: TeacherSite;
  courses: DemoCourse[];
  notices: { title: string; body?: string; pinned?: boolean; daysAgo: number }[];
};

const HSC_PHYSICS_1 = [
  { title: "ভৌতজগৎ ও পরিমাপ", status: "done", startsOn: "2026-09-02", endsOn: "2026-09-14" },
  { title: "ভেক্টর", status: "done", startsOn: "2026-09-15", endsOn: "2026-09-30" },
  { title: "গতিবিদ্যা", status: "done", startsOn: "2026-10-01", endsOn: "2026-10-20" },
  { title: "নিউটনিয়ান বলবিদ্যা", status: "ongoing", startsOn: "2026-10-21", endsOn: "2026-11-08" },
  { title: "কাজ, শক্তি ও ক্ষমতা", startsOn: "2026-11-09", endsOn: "2026-11-25" },
  { title: "মহাকর্ষ ও অভিকর্ষ", startsOn: "2026-11-26", endsOn: "2026-12-12" },
  "পদার্থের গাঠনিক ধর্ম",
  "পর্যাবৃত্ত গতি",
  "তরঙ্গ",
  "আদর্শ গ্যাস ও গ্যাসের গতিতত্ত্ব",
] satisfies (string | DemoChapter)[];

const HSC_PHYSICS_2 = [
  "তাপগতিবিদ্যা",
  "স্থির তড়িৎ",
  "চল তড়িৎ",
  "তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব",
  "তাড়িতচৌম্বকীয় আবেশ ও পরবর্তী প্রবাহ",
  "জ্যামিতিক আলোকবিজ্ঞান",
  "ভৌত আলোকবিজ্ঞান",
  "আধুনিক পদার্থবিজ্ঞানের সূচনা",
  "পরমাণুর মডেল এবং নিউক্লিয়ার পদার্থবিজ্ঞান",
  "সেমিকন্ডাক্টর ও ইলেকট্রনিক্স",
  "জ্যোতির্বিজ্ঞান",
];

const SSC_PHYSICS = [
  { title: "ভৌত রাশি এবং পরিমাপ", status: "done" },
  { title: "গতি", status: "done" },
  { title: "বল", status: "ongoing" },
  "কাজ, ক্ষমতা ও শক্তি",
  "পদার্থের অবস্থা ও চাপ",
  "বস্তুর উপর তাপের প্রভাব",
  "তরঙ্গ ও শব্দ",
  "আলোর প্রতিফলন",
  "আলোর প্রতিসরণ",
  "স্থির তড়িৎ",
  "চল তড়িৎ",
  "বিদ্যুতের চৌম্বক ক্রিয়া",
  "আধুনিক পদার্থবিজ্ঞান ও ইলেকট্রনিক্স",
  "জীবন বাঁচাতে পদার্থবিজ্ঞান",
] satisfies (string | DemoChapter)[];

const SSC_HIGHER_MATH = [
  "সেট ও ফাংশন",
  "বীজগাণিতিক রাশি",
  "জ্যামিতি",
  "জ্যামিতিক অঙ্কন",
  "সমীকরণ",
  "অসমতা",
  "অসীম ধারা",
  "ত্রিকোণমিতি",
  "সূচকীয় ও লগারিদমীয় ফাংশন",
  "দ্বিপদী বিস্তৃতি",
  "স্থানাঙ্ক জ্যামিতি",
  "সমতলীয় ভেক্টর",
  "ঘন জ্যামিতি",
  "সম্ভাবনা",
];

const HSC_CHEMISTRY_1 = [
  { title: "ল্যাবরেটরির নিরাপদ ব্যবহার", status: "done", startsOn: "2026-09-05", endsOn: "2026-09-20" },
  { title: "গুণগত রসায়ন", status: "ongoing", startsOn: "2026-09-21", endsOn: "2026-11-10" },
  { title: "মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন", startsOn: "2026-11-11", endsOn: "2026-12-20" },
  "রাসায়নিক পরিবর্তন",
  "কর্মমুখী রসায়ন",
] satisfies (string | DemoChapter)[];

const DEMO: DemoTeacher[] = [
  {
    handle: "tanvir",
    firstHandle: "tanvir-ahmed",
    nameBn: "তানভীর আহমেদ",
    nameEn: "Tanvir Ahmed",
    phone: "01710000001",
    subjects: "পদার্থবিজ্ঞান · উচ্চতর গণিত",
    institution: "",
    theme: "ink",
    status: "approved",
    site: {
      designation: "প্রভাষক, পদার্থবিজ্ঞান",
      tagline:
        "সূত্র মুখস্থ নয়—ধারণা বুঝে, নিয়মিত অনুশীলন আর সাপ্তাহিক পরীক্ষায় প্রস্তুতি। অধ্যায়ভিত্তিক প্রশ্ন, বোর্ড প্রশ্ন আর তার সমাধান—সব এক জায়গায়।",
      location: "মিরপুর-১০, ঢাকা",
      admission: "ভর্তি চলছে: এইচএসসি ২০২৮",
      highlight: { value: "৪২ জন জিপিএ-৫", label: "এইচএসসি ২০২৫" },
      stats: [
        { value: "১২+", label: "বছরের শিক্ষকতা" },
        { value: "৩,২০০+", label: "শিক্ষার্থী পড়িয়েছি" },
        { value: "১,৮৫০+", label: "প্রশ্ন ও সমাধান" },
        { value: "৪৮টি", label: "লাইভ পরীক্ষা, ২০২৬" },
      ],
      about:
        "পদার্থবিজ্ঞানে স্নাতকোত্তর। বারো বছর ধরে এইচএসসি আর এসএসসির শিক্ষার্থীদের পড়াচ্ছি, অনলাইনে আর মিরপুরের কোচিংয়ে।\n\nপ্রতিটি অধ্যায় শুরু হয় বাস্তব উদাহরণ দিয়ে, শেষ হয় বোর্ড প্রশ্ন আর সাপ্তাহিক MCQ পরীক্ষা দিয়ে। কেউ পিছিয়ে পড়লে আলাদা করে সময় দিই।",
      contact: { phone: "01700000000", whatsapp: "01700000000", hours: "বিকেল ৩টা–রাত ৯টা", address: "মিরপুর-১০, ঢাকা (মেট্রো স্টেশনের কাছে)" },
      routine: [
        { batch: "এইচএসসি ২০২৮ (ক)", days: "শনি · সোম · বুধ", time: "বিকেল ৪:০০" },
        { batch: "এইচএসসি ২০২৮ (খ)", days: "রবি · মঙ্গল · বৃহস্পতি", time: "সন্ধ্যা ৬:০০" },
        { batch: "এইচএসসি ২০২৭", days: "শনি · সোম · বুধ", time: "সন্ধ্যা ৬:০০" },
        { batch: "এসএসসি ২০২৭", days: "রবি · মঙ্গল · বৃহস্পতি", time: "বিকেল ৪:০০" },
      ],
    },
    courses: [
      {
        title: "পদার্থবিজ্ঞান ১ম পত্র",
        level: "এইচএসসি",
        session: "এইচএসসি ২০২৮ ব্যাচ · সেপ্টেম্বর–ফেব্রুয়ারি",
        description:
          "এইচএসসি পদার্থবিজ্ঞান ১ম পত্রের দশটি অধ্যায়, পাঠ্যবইয়ের ক্রমে। প্রতি সপ্তাহে একটি লাইভ MCQ পরীক্ষা, প্রতি মাসে একটি পূর্ণাঙ্গ মডেল টেস্ট।",
        icon: "atom",
        cover: 1,
        access: "paid",
        price: 1200,
        chapters: HSC_PHYSICS_1,
      },
      { title: "পদার্থবিজ্ঞান ২য় পত্র", level: "এইচএসসি", icon: "zap", cover: 2, access: "approval", chapters: HSC_PHYSICS_2 },
      { title: "পদার্থবিজ্ঞান", level: "এসএসসি", session: "এসএসসি ২০২৭ ব্যাচ", icon: "magnet", cover: 3, access: "free", chapters: SSC_PHYSICS },
      { title: "উচ্চতর গণিত", level: "এসএসসি", icon: "sigma", cover: 4, access: "paid", price: 1000, chapters: SSC_HIGHER_MATH },
    ],
    notices: [
      { title: "এ সপ্তাহে শুক্রবারের ক্লাস রবিবার বিকেল ৪টায় হবে।", pinned: true, daysAgo: 2 },
      { title: "অক্টোবরের মাসিক পরীক্ষার ফলাফল প্রকাশিত হয়েছে।", body: "নিজের ফলাফল ও উত্তরপত্র দেখতে ক্লাসে খাতা সংগ্রহ করো।", daysAgo: 5 },
      { title: "এইচএসসি ২০২৮ ব্যাচে ভর্তি চলছে—আসন সীমিত।", daysAgo: 11 },
    ],
  },
  {
    handle: "nusrat",
    nameBn: "নুসরাত জাহান",
    nameEn: "Nusrat Jahan",
    phone: "01710000002",
    subjects: "রসায়ন",
    institution: "",
    theme: "mist",
    status: "approved",
    site: {
      designation: "প্রভাষক, রসায়ন",
      tagline: "বিক্রিয়া মুখস্থ নয়, কেন ঘটে তা বুঝে রসায়ন শেখা।",
      location: "ধানমন্ডি, ঢাকা",
      admission: "নতুন ব্যাচ শুরু: ১৫ নভেম্বর",
      highlight: { value: "৯৮%", label: "পাসের হার, ২০২৫" },
      stats: [
        { value: "৮+", label: "বছরের শিক্ষকতা" },
        { value: "১,৪০০+", label: "শিক্ষার্থী" },
        { value: "৬০০+", label: "সমাধানসহ প্রশ্ন" },
      ],
      contact: { phone: "01700000001", whatsapp: "01700000001", hours: "সন্ধ্যা ৬টা–রাত ১০টা" },
      routine: [
        { batch: "এইচএসসি ২০২৮", days: "শনি · মঙ্গল", time: "সন্ধ্যা ৭:০০" },
        { batch: "এসএসসি ২০২৭", days: "রবি · বুধ", time: "বিকেল ৫:০০" },
      ],
    },
    courses: [
      { title: "রসায়ন ১ম পত্র", level: "এইচএসসি", session: "এইচএসসি ২০২৮ ব্যাচ", icon: "flask-conical", cover: 1, access: "paid", price: 1000, chapters: HSC_CHEMISTRY_1 },
      { title: "রসায়ন ২য় পত্র", level: "এইচএসসি", icon: "dna", cover: 2, access: "approval", chapters: [] },
      { title: "রসায়ন", level: "এসএসসি", icon: "leaf", cover: 3, access: "free", chapters: [] },
    ],
    notices: [{ title: "১৫ নভেম্বর থেকে এইচএসসি ২০২৮ নতুন ব্যাচ শুরু।", pinned: true, daysAgo: 1 }],
  },
  {
    handle: "rafi",
    nameBn: "রাফি হাসান",
    nameEn: "Rafi Hasan",
    phone: "01710000003",
    subjects: "উচ্চতর গণিত",
    institution: "",
    theme: "sage",
    status: "pending",
    site: { designation: "গণিত শিক্ষক", location: "চট্টগ্রাম", tagline: "অঙ্ক ভয়ের নয়, ধাপে ধাপে বোঝার।" },
    courses: [{ title: "উচ্চতর গণিত", level: "এসএসসি", icon: "sigma", cover: 1, access: "free", chapters: SSC_HIGHER_MATH.slice(0, 5) }],
    notices: [],
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
    const id = teacher!.id;
    await setTeacherTheme(db, id, t.theme);
    await setTeacherStatus(db, id, t.status);
    await updateSite(db, id, t.site);

    if ((await listCourses(db, id)).length === 0) {
      for (const c of t.courses) {
        const course = await createCourse(db, id, {
          title: c.title,
          level: c.level,
          session: c.session ?? "",
          description: c.description ?? "",
          icon: c.icon as never,
          cover: c.cover,
          access: c.access,
          price: c.price ?? 0,
          pricePeriod: "monthly",
          published: true,
        });
        for (const ch of c.chapters) {
          const chapter = typeof ch === "string" ? { title: ch } : ch;
          await addChapter(db, id, course.id, {
            label: "",
            title: chapter.title,
            status: chapter.status ?? "upcoming",
            startsOn: chapter.startsOn ?? null,
            endsOn: chapter.endsOn ?? null,
          });
        }
      }
      for (const n of t.notices) {
        const notice = await createNotice(db, id, { title: n.title, body: n.body ?? "", pinned: n.pinned ?? false });
        const publishedAt = new Date(Date.now() - n.daysAgo * 86_400_000);
        await db.update(noticesTable).set({ publishedAt }).where(eq(noticesTable.id, notice.id));
      }
    }
    console.log(`lecturer.bd/${t.handle}  (${t.theme}, ${t.status}, ${t.courses.length} courses)`);
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
