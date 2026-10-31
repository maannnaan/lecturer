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
    /** e.g. "এইচএসসি", "এসএসসি", "Class 8" */
    level: text("level").notNull().default(""),
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
