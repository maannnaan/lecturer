// Demo data for local development: an admin and three teachers (one per theme) with filled-in
// websites, courses, lesson plans, question banks and notices, plus an old address that
// redirects. Safe to run twice. Refuses to touch a real (postgres://) database. All people and
// details are made up.
//
//   npm run seed:demo        then  npm run dev
//
// Admin:    admin@lecturer.test / admin-password        (lecturer.bd/admin)
// Teachers: 01710000001…3       / teacher-password      (lecturer.bd/login)
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { upsertAdmin } from "@/server/admins";
import { notices as noticesTable, type TeacherSite } from "@/server/db/schema";
import { databaseUrl } from "@/server/db/url";
import type { Grade } from "@/lib/grades";
import { parseQuestion } from "@/lib/questions";
import type { ThemeName } from "@/lib/themes";
import { addChapter, createCourse, listCourses } from "@/server/courses";
import { createNotice } from "@/server/notices";
import { createQuestion } from "@/server/questions";
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
/** A question as the editor's fields (see parseQuestion); course and chapter are filled in. */
type DemoQuestion = Record<string, string>;
type DemoCourse = {
  title: string;
  grade: Grade;
  subject: string;
  session?: string;
  description?: string;
  icon: string;
  cover: number;
  access: "free" | "approval" | "paid";
  price?: number;
  chapters: (string | DemoChapter)[];
  /** Questions by chapter index (0 = the first chapter). */
  questions?: Record<number, DemoQuestion[]>;
};

// The questions from the Phase 0 chapter mockup, plus a few more of each kind.
const NEWTONIAN_MECHANICS: DemoQuestion[] = [
  {
    type: "mcq",
    board: "dhaka",
    year: "2023",
    stem: String.raw`$2\,\text{kg}$ ভরের একটি বস্তুর উপর $10\,\text{N}$ বল প্রয়োগ করলে বস্তুটির ত্বরণ কত হবে?`,
    option0: String.raw`$2\,\text{m s}^{-2}$`,
    option1: String.raw`$5\,\text{m s}^{-2}$`,
    option2: String.raw`$10\,\text{m s}^{-2}$`,
    option3: String.raw`$20\,\text{m s}^{-2}$`,
    answer: "1",
    explanation: String.raw`নিউটনের দ্বিতীয় সূত্র থেকে $F = ma \;\Rightarrow\; a = \dfrac{F}{m} = \dfrac{10}{2} = 5\,\text{m s}^{-2}$`,
  },
  {
    type: "mcq",
    board: "chattogram",
    year: "2024",
    stem: String.raw`একটি রকেট প্রতি সেকেন্ডে $0.5\,\text{kg}$ গ্যাস রকেটের সাপেক্ষে $2000\,\text{m s}^{-1}$ বেগে নির্গত করে। রকেটের উপর ক্রিয়াশীল ঘাত বল কত?`,
    option0: String.raw`$250\,\text{N}$`,
    option1: String.raw`$1000\,\text{N}$`,
    option2: String.raw`$2000\,\text{N}$`,
    option3: String.raw`$4000\,\text{N}$`,
    answer: "1",
    explanation: String.raw`ঘাত বল, $F = v\,\dfrac{dm}{dt} = 2000 \times 0.5 = 1000\,\text{N}$`,
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  },
  {
    type: "mcq_multi",
    board: "rajshahi",
    year: "2022",
    stem: "ভরবেগ সম্পর্কে নিচের তথ্যগুলো লক্ষ কর—",
    statement0: "ভরবেগ একটি ভেক্টর রাশি",
    statement1: String.raw`ভরবেগের একক $\text{kg m s}^{-1}$`,
    statement2: "বলের ঘাত ভরবেগের পরিবর্তনের সমান",
    option0: "i ও ii",
    option1: "i ও iii",
    option2: "ii ও iii",
    option3: "i, ii ও iii",
    answer: "3",
    explanation: String.raw`তিনটিই সঠিক: $\vec p = m\vec v$ ভেক্টর রাশি, একক $\text{kg m s}^{-1}$, আর ঘাত $\vec J = \Delta \vec p$।`,
  },
  {
    type: "creative",
    board: "dhaka",
    year: "2023",
    stem: String.raw`$5\,\text{kg}$ ভরের একটি বাক্সকে অনুভূমিকের সাথে $30^\circ$ কোণে আনত একটি তলের উপর রাখা হলো। তল ও বাক্সের মধ্যে গতীয় ঘর্ষণ সহগ $\mu_k = 0.2$ এবং $g = 9.8\,\text{m s}^{-2}$।`,
    part0: "নিউটনের গতির প্রথম সূত্রটি লিখ।",
    part1: "ঘর্ষণ বল কেন সবসময় আপেক্ষিক গতির বিপরীতে ক্রিয়া করে? ব্যাখ্যা কর।",
    part2: "বাক্সটির উপর ক্রিয়াশীল গতীয় ঘর্ষণ বল নির্ণয় কর।",
    solution2: String.raw`অভিলম্ব প্রতিক্রিয়া
$$\begin{aligned} R &= mg\cos 30^\circ \\ &= 5 \times 9.8 \times 0.866 \\ &\approx 42.43\ \text{N} \end{aligned}$$
সুতরাং গতীয় ঘর্ষণ বল
$$\begin{aligned} f_k &= \mu_k R = 0.2 \times 42.43 \\ &\approx 8.49\ \text{N} \end{aligned}$$`,
    part3: "বাক্সটি কি তল বেয়ে নিচের দিকে নামবে? গাণিতিক যুক্তিসহ মতামত দাও।",
    solution3: String.raw`তল বরাবর নিচের দিকে ওজনের উপাংশ $mg\sin 30^\circ = 5 \times 9.8 \times 0.5 = 24.5\,\text{N}$, যা ঘর্ষণ বলের ($\approx 8.49\,\text{N}$) চেয়ে বেশি। তাই বাক্সটি ত্বরণসহ নিচে নামবে।`,
  },
  {
    type: "short",
    stem: "জড়তা কাকে বলে?",
    modelAnswer: "বস্তু যে অবস্থায় আছে সেই অবস্থায় থাকতে চাওয়ার প্রবণতাকে জড়তা বলে। জড়তা দুই প্রকার: স্থিতি জড়তা ও গতি জড়তা।",
  },
  {
    type: "textbook",
    source: "মূল বই, অনুশীলনী ৪.৩",
    stem: String.raw`$1000\,\text{kg}$ ভরের একটি গাড়ি $20\,\text{m s}^{-1}$ বেগে চলছে। $5\,\text{s}$-এ গাড়িটি থামাতে কত বল প্রয়োগ করতে হবে?`,
    finalAnswer: String.raw`$4000\,\text{N}$, গতির বিপরীত দিকে`,
    solution: String.raw`মন্দন $a = \dfrac{0 - 20}{5} = -4\,\text{m s}^{-2}$।
সুতরাং $F = ma = 1000 \times (-4) = -4000\,\text{N}$; অর্থাৎ গতির বিপরীত দিকে $4000\,\text{N}$ বল লাগবে।`,
  },
  {
    type: "practice",
    stem: String.raw`$5\,\text{kg}$ ভরের একটি বস্তুর উপর $20\,\text{N}$ বল $4\,\text{s}$ ধরে ক্রিয়া করে। বস্তুটির ভরবেগের পরিবর্তন কত?`,
    finalAnswer: String.raw`$80\,\text{kg m s}^{-1}$`,
    solution: String.raw`ভরবেগের পরিবর্তন = বলের ঘাত $= Ft = 20 \times 4 = 80\,\text{kg m s}^{-1}$`,
  },
  {
    type: "practice",
    stem: String.raw`একটি লিফট $2\,\text{m s}^{-2}$ ত্বরণে উপরে উঠছে। লিফটে দাঁড়ানো $60\,\text{kg}$ ভরের একজন মানুষের আপাত ওজন কত? ($g = 9.8\,\text{m s}^{-2}$)`,
    finalAnswer: String.raw`$708\,\text{N}$`,
  },
  {
    type: "mcq",
    visibility: "private",
    stem: "কোনটি নিউটনের তৃতীয় সূত্রের উদাহরণ?",
    option0: "নৌকা থেকে লাফ দিলে নৌকা পিছিয়ে যায়",
    option1: "ঘূর্ণায়মান চাকা থেমে যায়",
    option2: "গাছ থেকে আপেল পড়ে",
    option3: "টেবিলের উপর বই স্থির থাকে",
    answer: "0",
  },
];

const KINEMATICS: DemoQuestion[] = [
  {
    type: "mcq",
    stem: String.raw`স্থির অবস্থান থেকে $2\,\text{m s}^{-2}$ সুষম ত্বরণে চলা একটি বস্তু $5\,\text{s}$-এ কত দূরত্ব অতিক্রম করবে?`,
    option0: String.raw`$10\,\text{m}$`,
    option1: String.raw`$25\,\text{m}$`,
    option2: String.raw`$50\,\text{m}$`,
    option3: String.raw`$5\,\text{m}$`,
    answer: "1",
    explanation: String.raw`$s = \tfrac{1}{2}at^2 = \tfrac{1}{2} \times 2 \times 5^2 = 25\,\text{m}$`,
  },
  {
    type: "mcq",
    board: "jashore",
    year: "2023",
    stem: "প্রক্ষেপকের অনুভূমিক পাল্লা সর্বোচ্চ হয় কোন নিক্ষেপ কোণে?",
    option0: String.raw`$30^\circ$`,
    option1: String.raw`$45^\circ$`,
    option2: String.raw`$60^\circ$`,
    option3: String.raw`$90^\circ$`,
    answer: "1",
    explanation: String.raw`$R = \dfrac{u^2 \sin 2\theta}{g}$, যা $\sin 2\theta = 1$ অর্থাৎ $\theta = 45^\circ$ হলে সর্বোচ্চ।`,
  },
];

// SSC physics, chapter 2 (গতি): so the website's question bank has a second class.
const SSC_MOTION: DemoQuestion[] = [
  {
    type: "mcq",
    stem: "সুষম বেগে চলমান কোনো বস্তুর ত্বরণ কত?",
    option0: "শূন্য",
    option1: "ধ্রুব, কিন্তু শূন্য নয়",
    option2: "সময়ের সাথে বাড়ে",
    option3: "সময়ের সাথে কমে",
    answer: "0",
    explanation: "বেগ বদলায় না বলে বেগের পরিবর্তনের হার, অর্থাৎ ত্বরণ, শূন্য।",
  },
  {
    type: "textbook",
    source: "মূল বই, অনুশীলনী ২.৫",
    stem: String.raw`একটি গাড়ি $10\,\text{s}$-এ $200\,\text{m}$ পথ অতিক্রম করে। গাড়িটির গড় দ্রুতি কত?`,
    finalAnswer: String.raw`$20\,\text{m s}^{-1}$`,
    solution: String.raw`গড় দ্রুতি $= \dfrac{\text{অতিক্রান্ত দূরত্ব}}{\text{সময়}} = \dfrac{200}{10} = 20\,\text{m s}^{-1}$`,
  },
];

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
        grade: "hsc",
        subject: "পদার্থবিজ্ঞান ১ম পত্র",
        session: "এইচএসসি ২০২৮ ব্যাচ · সেপ্টেম্বর–ফেব্রুয়ারি",
        description:
          "এইচএসসি পদার্থবিজ্ঞান ১ম পত্রের দশটি অধ্যায়, পাঠ্যবইয়ের ক্রমে। প্রতি সপ্তাহে একটি লাইভ MCQ পরীক্ষা, প্রতি মাসে একটি পূর্ণাঙ্গ মডেল টেস্ট।",
        icon: "atom",
        cover: 1,
        access: "paid",
        price: 1200,
        chapters: HSC_PHYSICS_1,
        questions: { 2: KINEMATICS, 3: NEWTONIAN_MECHANICS },
      },
      {
        title: "পদার্থবিজ্ঞান ২য় পত্র",
        grade: "hsc",
        subject: "পদার্থবিজ্ঞান ২য় পত্র",
        icon: "zap",
        cover: 2,
        access: "approval",
        chapters: HSC_PHYSICS_2,
      },
      {
        title: "পদার্থবিজ্ঞান",
        grade: "ssc",
        subject: "পদার্থবিজ্ঞান",
        session: "এসএসসি ২০২৭ ব্যাচ",
        icon: "magnet",
        cover: 3,
        access: "free",
        chapters: SSC_PHYSICS,
        questions: { 1: SSC_MOTION },
      },
      {
        title: "উচ্চতর গণিত",
        grade: "ssc",
        subject: "উচ্চতর গণিত",
        icon: "sigma",
        cover: 4,
        access: "paid",
        price: 1000,
        chapters: SSC_HIGHER_MATH,
      },
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
      {
        title: "রসায়ন ১ম পত্র",
        grade: "hsc",
        subject: "রসায়ন ১ম পত্র",
        session: "এইচএসসি ২০২৮ ব্যাচ",
        icon: "flask-conical",
        cover: 1,
        access: "paid",
        price: 1000,
        chapters: HSC_CHEMISTRY_1,
        questions: {
          1: [
            {
              type: "mcq",
              board: "dhaka",
              year: "2024",
              stem: "কোন কোয়ান্টাম সংখ্যা ইলেকট্রনের ঘূর্ণনের দিক নির্দেশ করে?",
              option0: "প্রধান কোয়ান্টাম সংখ্যা",
              option1: "সহকারী কোয়ান্টাম সংখ্যা",
              option2: "চৌম্বক কোয়ান্টাম সংখ্যা",
              option3: "স্পিন কোয়ান্টাম সংখ্যা",
              answer: "3",
              explanation: String.raw`স্পিন কোয়ান্টাম সংখ্যা $s = \pm\tfrac{1}{2}$ ইলেকট্রনের ঘূর্ণনের দিক নির্দেশ করে।`,
            },
          ],
        },
      },
      { title: "রসায়ন ২য় পত্র", grade: "hsc", subject: "রসায়ন ২য় পত্র", icon: "dna", cover: 2, access: "approval", chapters: [] },
      { title: "রসায়ন", grade: "ssc", subject: "রসায়ন", icon: "leaf", cover: 3, access: "free", chapters: [] },
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
    courses: [
      { title: "উচ্চতর গণিত", grade: "ssc", subject: "উচ্চতর গণিত", icon: "sigma", cover: 1, access: "free", chapters: SSC_HIGHER_MATH.slice(0, 5) },
    ],
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
          grade: c.grade,
          subject: c.subject,
          session: c.session ?? "",
          description: c.description ?? "",
          icon: c.icon as never,
          cover: c.cover,
          access: c.access,
          price: c.price ?? 0,
          pricePeriod: "monthly",
          published: true,
        });
        const chapterIds: string[] = [];
        for (const ch of c.chapters) {
          const chapter = typeof ch === "string" ? { title: ch } : ch;
          const added = await addChapter(db, id, course.id, {
            label: "",
            title: chapter.title,
            status: chapter.status ?? "upcoming",
            startsOn: chapter.startsOn ?? null,
            endsOn: chapter.endsOn ?? null,
          });
          chapterIds.push(added!.id);
        }
        for (const [index, list] of Object.entries(c.questions ?? {})) {
          for (const fields of list) {
            const { question, errors } = parseQuestion({ ...fields, courseId: course.id, chapterId: chapterIds[Number(index)] });
            if (Object.keys(errors).length > 0) throw new Error(`Demo question refused: ${JSON.stringify(errors)}`);
            const result = await createQuestion(db, id, question);
            if (!result.ok) throw new Error(`Demo question not saved: ${result.reason}`);
          }
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

if (/^postgres(ql)?:\/\//.test(databaseUrl() ?? "")) {
  console.error("seed:demo only writes to the local embedded database. Unset DATABASE_URL and LECTURER_DATABASE_URL.");
  process.exit(1);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
