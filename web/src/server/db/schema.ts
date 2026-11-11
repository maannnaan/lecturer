import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const teacherStatus = pgEnum("teacher_status", ["pending", "approved", "rejected", "suspended"]);
export const themeName = pgEnum("theme_name", ["ink", "mist", "sage"]);
export const localeName = pgEnum("locale_name", ["bn", "en"]);
export const sessionKind = pgEnum("session_kind", ["admin", "teacher", "student"]);

/** Platform staff. Created by `npm run seed:admin`, never by sign-up. */
export const admins = pgTable(
  "admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("admins_email_key").on(t.email)],
);

export type SiteStat = { value: string; label: string };
export type RoutineRow = { batch: string; days: string; time: string };
export type SiteContact = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  facebook?: string;
  youtube?: string;
  address?: string;
  hours?: string;
};

/**
 * What the teacher's own website shows beyond the account fields. Every part is optional: a
 * section with nothing in it is simply left off the site. Validated in src/lib/site.ts.
 */
export type TeacherSite = {
  /** e.g. "প্রভাষক, পদার্থবিজ্ঞান" */
  designation?: string;
  /** One line under the name. */
  tagline?: string;
  /** Plain paragraphs for now; becomes rich text with the Phase 3 editor. */
  about?: string;
  /** e.g. "মিরপুর-১০, ঢাকা" */
  location?: string;
  /** e.g. "ভর্তি চলছে: এইচএসসি ২০২৮" */
  admission?: string;
  /** The one achievement shown on the photo, e.g. { value: "৪২ জন জিপিএ-৫", label: "এইচএসসি ২০২৫" }. */
  highlight?: SiteStat | null;
  /** Up to four figures under the hero. */
  stats?: SiteStat[];
  photo?: { mediaId: string; url: string } | null;
  contact?: SiteContact;
  /** The class schedule table: which batch meets when. */
  routine?: RoutineRow[];
};

/**
 * A teacher is a tenant: every course, question, student and payment hangs off one of these rows.
 * `handle` is the current address (lecturer.bd/<handle>); every handle ever used, current or
 * retired, is also kept in `handles`, which is what makes an old address redirect and stay taken.
 */
export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: text("handle").notNull(),
    nameBn: text("name_bn").notNull(),
    nameEn: text("name_en").notNull(),
    /** Normalised Bangladesh mobile number, 01XXXXXXXXX. */
    phone: text("phone").notNull(),
    /** Lower-cased; optional. */
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    status: teacherStatus("status").notNull().default("pending"),
    /** Why the admin rejected or suspended the account; shown to the teacher. */
    statusNote: text("status_note").notNull().default(""),
    subjects: text("subjects").notNull().default(""),
    institution: text("institution").notNull().default(""),
    theme: themeName("theme").notNull().default("ink"),
    /** The language the teacher's website opens in; a visitor's own choice overrides it. */
    locale: localeName("locale").notNull().default("bn"),
    site: jsonb("site").$type<TeacherSite>().notNull().default({}),
    /** The last course number handed out; numbers are never reused, so old links never repoint. */
    courseCounter: integer("course_counter").notNull().default(0),
    /** The same for the question bank's subjects. */
    subjectCounter: integer("subject_counter").notNull().default(0),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("teachers_handle_key").on(t.handle),
    uniqueIndex("teachers_phone_key").on(t.phone),
    uniqueIndex("teachers_email_key").on(t.email).where(sql`${t.email} is not null`),
    index("teachers_status_created_idx").on(t.status, t.createdAt),
  ],
);

/** Every handle a teacher has had. The primary key keeps a retired handle from being reused. */
export const handles = pgTable(
  "handles",
  {
    handle: text("handle").primaryKey(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    current: boolean("current").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("handles_teacher_idx").on(t.teacherId)],
);

/**
 * A student of one teacher. Accounts are per teacher site by design: the same phone number can
 * belong to two students of two different teachers, never twice under one teacher.
 * Extended in Phase 4 (batches, rolls, guardians); Phase 1 only needs enough to sign in.
 */
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    /** Null for an offline student who has not been given a login yet. */
    passwordHash: text("password_hash"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("students_teacher_phone_key").on(t.teacherId, t.phone)],
);

/**
 * Sign-in sessions for all three kinds of account. The cookie holds a random token; only its
 * SHA-256 is stored here, so a leaked table can't be replayed as cookies.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    kind: sessionKind("kind").notNull(),
    adminId: uuid("admin_id").references(() => admins.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("sessions_admin_idx").on(t.adminId),
    index("sessions_teacher_idx").on(t.teacherId),
    index("sessions_student_idx").on(t.studentId),
    check(
      "sessions_owner_matches_kind",
      sql`(${t.kind} = 'admin' and ${t.adminId} is not null and ${t.teacherId} is null and ${t.studentId} is null)
        or (${t.kind} = 'teacher' and ${t.teacherId} is not null and ${t.adminId} is null and ${t.studentId} is null)
        or (${t.kind} = 'student' and ${t.studentId} is not null and ${t.teacherId} is not null and ${t.adminId} is null)`,
    ),
  ],
);

export const courseAccess = pgEnum("course_access", ["free", "approval", "paid"]);
export const pricePeriod = pgEnum("price_period", ["one_time", "monthly"]);
export const chapterStatus = pgEnum("chapter_status", ["upcoming", "ongoing", "done"]);
export const mediaStorage = pgEnum("media_storage", ["cloudinary", "local"]);

/**
 * A course a teacher runs, e.g. HSC Physics 1st paper. Its public address is
 * lecturer.bd/<handle>/courses/<number>; the number comes from teachers.course_counter and is
 * never reused. `access` and the price are shown now and enforced from Phase 4.
 */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    /**
     * The old free-text class ("এইচএসসি", "Class 8"). Unused since `grade` and `subject` replaced
     * it; kept one release so the previous deployment still runs, dropped in Phase 4's migration.
     */
    level: text("level").notNull().default(""),
    /** The class the course is for, shown on its cover: a key from GRADES in src/lib/grades.ts. */
    grade: text("grade").notNull().default("other"),
    /** Unused since the question bank got its own subjects (0004); dropped in Phase 4's migration. */
    subject: text("subject").notNull().default(""),
    /** e.g. "এইচএসসি ২০২৮ ব্যাচ · সেপ্টেম্বর–ফেব্রুয়ারি" */
    session: text("session").notNull().default(""),
    description: text("description").notNull().default(""),
    /** One of COURSE_ICONS in src/lib/courses.ts. */
    icon: text("icon").notNull().default("book-open"),
    /** Which of the theme's four cover colours, 1–4. */
    cover: integer("cover").notNull().default(1),
    access: courseAccess("access").notNull().default("approval"),
    /** Taka; 0 for a free course. */
    price: integer("price").notNull().default(0),
    pricePeriod: pricePeriod("price_period").notNull().default("monthly"),
    published: boolean("published").notNull().default(false),
    position: integer("position").notNull().default(0),
    /** The last chapter number handed out in this course. */
    chapterCounter: integer("chapter_counter").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("courses_teacher_number_key").on(t.teacherId, t.number),
    index("courses_teacher_position_idx").on(t.teacherId, t.position),
  ],
);

/**
 * A chapter of a course, in the order the teacher teaches it. `number` is its stable address
 * inside the course (chapter pages arrive in Phase 3); `label` overrides the shown "অধ্যায় N",
 * which otherwise follows the chapter's position.
 */
export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    label: text("label").notNull().default(""),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    status: chapterStatus("status").notNull().default("upcoming"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chapters_course_number_key").on(t.courseId, t.number),
    index("chapters_course_position_idx").on(t.courseId, t.position),
    index("chapters_teacher_idx").on(t.teacherId),
  ],
);

/** A notice on the teacher's website: a class moved, results out, admissions open. */
export const notices = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("notices_teacher_published_idx").on(t.teacherId, t.publishedAt)],
);

/**
 * A class the teacher keeps questions for (a key from GRADES), added with the bank's "নতুন শ্রেণি".
 * The bank lists these, even before they have a subject; adding a subject to a class adds the class.
 */
export const bankClasses = pgTable(
  "bank_classes",
  {
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    grade: text("grade").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.grade] })],
);

/**
 * A subject in the teacher's question bank, e.g. এইচএসসি পদার্থবিজ্ঞান ১ম পত্র. The bank is browsed
 * class › subject › chapter › section, on its own: courses are what the website advertises.
 * `number` (from teachers.subject_counter, never reused) is its public address,
 * lecturer.bd/<handle>/bank/<class>/<number>.
 */
export const bankSubjects = pgTable(
  "bank_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** A key from GRADES in src/lib/grades.ts. */
    grade: text("grade").notNull().default("other"),
    /** A key from SUBJECT_GROUPS in src/lib/bank.ts (বিজ্ঞান, মানবিক…), or "" for none. */
    group: text("subject_group").notNull().default(""),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    /** The last chapter number handed out in this subject. */
    chapterCounter: integer("chapter_counter").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bank_subjects_teacher_number_key").on(t.teacherId, t.number),
    index("bank_subjects_teacher_position_idx").on(t.teacherId, t.position),
  ],
);

/**
 * A chapter of a bank subject, in textbook order. `number` is its stable address in the subject;
 * `label` overrides the shown "অধ্যায় N", which otherwise follows its position.
 */
export const bankChapters = pgTable(
  "bank_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => bankSubjects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    label: text("label").notNull().default(""),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bank_chapters_subject_number_key").on(t.subjectId, t.number),
    index("bank_chapters_subject_position_idx").on(t.subjectId, t.position),
    index("bank_chapters_teacher_idx").on(t.teacherId),
  ],
);

// In the database's own order: "textbook" was "problem" until migration 0003 renamed it.
export const questionType = pgEnum("question_type", ["mcq", "mcq_multi", "short", "creative", "textbook", "practice"]);
export const questionVisibility = pgEnum("question_visibility", ["public", "private"]);

export type QuestionImage = { mediaId: string; url: string };
/** One part of a creative question (ক, খ, গ, ঘ) with its marks and, optionally, a worked answer. */
export type CreativePart = { text: string; marks: number; solution: string };

/**
 * What a question says. Which fields are used depends on the question's type (validated in
 * src/lib/questions.ts); text may carry maths as $…$ or $$…$$.
 *   mcq        stem, options[4], answer, explanation
 *   mcq_multi  stem, statements[2–4], prompt, options[4], answer, explanation
 *   short      stem, modelAnswer
 *   creative   stem (the উদ্দীপক), parts[4]
 *   textbook   stem, finalAnswer, solution   (a numerical problem from the textbook)
 *   practice   stem, finalAnswer, solution   (an extra numerical problem to practise)
 */
export type QuestionBody = {
  stem: string;
  image?: QuestionImage | null;
  statements?: string[];
  prompt?: string;
  options?: string[];
  /** Index of the correct option, 0–3. */
  answer?: number;
  explanation?: string;
  modelAnswer?: string;
  parts?: CreativePart[];
  /** A problem's result on its own, e.g. "৫ m s⁻²". */
  finalAnswer?: string;
  solution?: string;
};

/**
 * A question in the teacher's bank, filed under a subject and (usually) one of its chapters.
 * Public questions appear on the website's chapter pages for practice; private ones are kept for
 * exams and papers. `board`/`year` mark a board-exam question (a key from BOARDS).
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => bankSubjects.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id").references(() => bankChapters.id, { onDelete: "set null" }),
    /** Unused since migration 0004 moved questions from courses to bank subjects; dropped in Phase 4. */
    courseId: uuid("course_id"),
    type: questionType("type").notNull(),
    visibility: questionVisibility("visibility").notNull().default("public"),
    body: jsonb("body").$type<QuestionBody>().notNull(),
    board: text("board").notNull().default(""),
    year: integer("year"),
    /** A key from DIFFICULTIES in src/lib/questions.ts, or "" when not set. */
    difficulty: text("difficulty").notNull().default(""),
    /** Where else it is from, e.g. "নটর ডেম কলেজ, টেস্ট ২০২৪". */
    source: text("source").notNull().default(""),
    /** A YouTube link to a video solution. */
    videoUrl: text("video_url").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("questions_teacher_subject_chapter_idx").on(t.teacherId, t.subjectId, t.chapterId, t.position),
    index("questions_teacher_type_idx").on(t.teacherId, t.type),
    index("questions_chapter_visibility_idx").on(t.chapterId, t.visibility),
  ],
);

/** An image a teacher uploaded, wherever it is stored. Counted against storage limits later. */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    storage: mediaStorage("storage").notNull(),
    /** Cloudinary public_id, or the file name under the local uploads folder. */
    key: text("key").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("media_teacher_idx").on(t.teacherId)],
);

/** Fixed-window counters for throttling sign-in attempts and similar abuse-prone actions. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
