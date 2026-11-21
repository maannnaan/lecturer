import { sql } from "drizzle-orm";
import type { RichDoc, RichText } from "@/lib/rich-text";
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

/** The teacher's numbers for Send Money, and their own instructions. A method without a number isn't offered. */
export type PaymentInfo = { bkash?: string; nagad?: string; rocket?: string; bank?: string; instructions?: string };

/**
 * What the teacher's own website shows beyond the account fields. Every part is optional: a
 * section with nothing in it is simply left off the site. Validated in src/lib/site.ts.
 */
export type TeacherSite = {
  /** e.g. "প্রভাষক, পদার্থবিজ্ঞান" */
  designation?: string;
  /** One line under the name. */
  tagline?: string;
  /** The "about me" text as plain text: older sites' only copy, and what page descriptions use. */
  about?: string;
  /** The same text as the editor wrote it (src/lib/rich-text.ts); shown when present. */
  aboutRich?: RichDoc | null;
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
    /** The same for the question bank's classes. */
    classCounter: integer("class_counter").notNull().default(0),
    /** The last receipt number handed out. */
    receiptCounter: integer("receipt_counter").notNull().default(0),
    /** The last exam number handed out: an exam's address is lecturer.bd/<handle>/exams/<number>. */
    examCounter: integer("exam_counter").notNull().default(0),
    /** The last question paper number handed out. */
    paperCounter: integer("paper_counter").notNull().default(0),
    /** Where students send money, and what to tell them: shown on their payment page. */
    paymentInfo: jsonb("payment_info").$type<PaymentInfo>().notNull().default({}),
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

export const studentStatus = pgEnum("student_status", ["active", "inactive"]);
/** How a student, or an enrolment, came to be: signed up on the website, or added by the teacher. */
export const studentSource = pgEnum("student_source", ["online", "offline"]);

/**
 * A student of one teacher. Accounts are per teacher site by design: the same phone number can
 * belong to two students of two different teachers, never twice under one teacher. What course
 * and batch a student is in, and their roll there, is on `enrollments`.
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
    guardianName: text("guardian_name").notNull().default(""),
    /** Normalised like `phone`, or "". */
    guardianPhone: text("guardian_phone").notNull().default(""),
    /** The school or college the student goes to. */
    institution: text("institution").notNull().default(""),
    /** In the student's or teacher's own words: "একাদশ", "HSC 2027". */
    classLevel: text("class_level").notNull().default(""),
    address: text("address").notNull().default(""),
    /** The teacher's own note; never shown to the student. */
    note: text("note").notNull().default(""),
    /** An inactive student keeps their record but can't sign in. */
    status: studentStatus("status").notNull().default("active"),
    source: studentSource("source").notNull().default("online"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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
    /** The class the course is for, shown on its cover: a key from GRADES in src/lib/grades.ts. */
    grade: text("grade").notNull().default("other"),
    /** e.g. "এইচএসসি ২০২৮ ব্যাচ · সেপ্টেম্বর–ফেব্রুয়ারি" */
    session: text("session").notNull().default(""),
    /** As plain text: older courses' only copy, and what page descriptions use. */
    description: text("description").notNull().default(""),
    /** The description as the editor wrote it (src/lib/rich-text.ts); shown when present. */
    descriptionRich: jsonb("description_rich").$type<RichDoc>(),
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

/**
 * A batch of a course: the group that meets together ("শনি-সোম-বুধ, বিকেল ৪টা"). A course needs
 * none; with some, a student asking to join picks one of the open ones.
 */
export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** When it meets, in the teacher's words. */
    schedule: text("schedule").notNull().default(""),
    /** The most students it takes, or null for no limit. */
    capacity: integer("capacity"),
    /** Whether new students can ask to join it. */
    open: boolean("open").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("batches_course_name_key").on(t.courseId, t.name), index("batches_teacher_idx").on(t.teacherId)],
);

export const enrollmentStatus = pgEnum("enrollment_status", ["pending", "active", "rejected", "left"]);

/**
 * A student in a course: asked to join (pending), in it (active), turned down (rejected) or gone
 * (left). One row per student and course. `roll` is digits only, at most 8, and unique within the
 * course: it is what the OMR sheet's roll grid carries.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    status: enrollmentStatus("status").notNull().default("pending"),
    roll: text("roll"),
    /** Taka a month (or once, by the course's price period): the course's price unless the teacher changed it. */
    fee: integer("fee").notNull().default(0),
    /** The first month the fee is due, "YYYY-MM" in Asia/Dhaka; "" until the student is in. */
    startMonth: text("start_month").notNull().default(""),
    /** What the student wrote when asking. */
    note: text("note").notNull().default(""),
    /** What the teacher answered, e.g. why not. Shown to the student. */
    decisionNote: text("decision_note").notNull().default(""),
    source: studentSource("source").notNull().default("online"),
    createdAt: createdAt(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("enrollments_student_course_key").on(t.studentId, t.courseId),
    uniqueIndex("enrollments_course_roll_key").on(t.courseId, t.roll).where(sql`${t.roll} is not null`),
    index("enrollments_teacher_status_idx").on(t.teacherId, t.status),
    index("enrollments_batch_idx").on(t.batchId),
  ],
);

export const paymentKind = pgEnum("payment_kind", ["monthly", "one_time", "other"]);
/** `bkash_gateway` is a payment bKash itself confirmed; the rest are told to us (by the teacher, or a student's claim). */
export const paymentMethod = pgEnum("payment_method", ["cash", "bkash", "nagad", "rocket", "bank", "other", "bkash_gateway"]);
/** A student's claim waits (pending) until the teacher verifies or rejects it; `failed` is a gateway payment that didn't go through. */
export const paymentStatus = pgEnum("payment_status", ["pending", "verified", "rejected", "failed"]);
export const paymentRecorder = pgEnum("payment_recorder", ["teacher", "student"]);

/**
 * Money a student paid the teacher. Amounts are whole taka. A payment the teacher records is
 * verified at once; one a student reports (Send Money with its TxnID) is pending until the
 * teacher has checked it. `receiptNo` comes from teachers.receipt_counter when it is verified,
 * and is never reused.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** The course it is for; null for a payment for something else, or once the enrolment is deleted. */
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "set null" }),
    kind: paymentKind("kind").notNull().default("monthly"),
    amount: integer("amount").notNull(),
    method: paymentMethod("method").notNull().default("cash"),
    status: paymentStatus("status").notNull().default("pending"),
    /** The transaction id of a mobile or bank payment, upper-cased; "" for cash. */
    txnId: text("txn_id").notNull().default(""),
    /** The number the money was sent from, or "". */
    senderNumber: text("sender_number").notNull().default(""),
    gatewayPaymentId: text("gateway_payment_id").notNull().default(""),
    /**
     * A pending bKash gateway payment's stage: "" while the student is at bKash's page, "checking"
     * once they are back and it is being confirmed, "unconfirmed" when bKash's answer couldn't be
     * had: then the teacher checks their merchant account and verifies or rejects it.
     */
    gatewayState: text("gateway_state").notNull().default(""),
    receiptNo: integer("receipt_no"),
    /** The teacher's note, or why a claim was rejected (shown to the student). */
    note: text("note").notNull().default(""),
    recordedBy: paymentRecorder("recorded_by").notNull().default("teacher"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_teacher_status_idx").on(t.teacherId, t.status, t.paidAt),
    index("payments_student_idx").on(t.studentId),
    // One transaction id can't be claimed twice (a rejected claim's id is free again).
    uniqueIndex("payments_teacher_txn_key")
      .on(t.teacherId, t.method, t.txnId)
      .where(sql`${t.txnId} <> '' and ${t.status} in ('pending', 'verified')`),
    uniqueIndex("payments_teacher_receipt_key").on(t.teacherId, t.receiptNo).where(sql`${t.receiptNo} is not null`),
  ],
);

/**
 * The months a payment covers, one row each ("YYYY-MM"; "once" for a course paid in one go). The
 * unique index is what stops a month being paid twice; a rejected or failed payment's rows are
 * deleted, which frees its months.
 */
export const paymentMonths = pgTable(
  "payment_months",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
  },
  (t) => [uniqueIndex("payment_months_enrollment_month_key").on(t.enrollmentId, t.month), index("payment_months_payment_idx").on(t.paymentId)],
);

/** A bKash merchant account in bKash's test system (sandbox) or the real one (live). */
export const gatewayMode = pgEnum("gateway_mode", ["sandbox", "live"]);

/**
 * A teacher's own bKash merchant account (Tokenized Checkout), so their students can pay through
 * bKash and the payment confirms itself. The password and app secret are kept sealed
 * (src/server/crypto.ts, with the server's SECRETS_KEY), and so are the tokens bKash hands out: a
 * token is reused until it runs out, since bKash refuses more than two new ones an hour.
 */
export const teacherGateways = pgTable("teacher_gateways", {
  teacherId: uuid("teacher_id")
    .primaryKey()
    .references(() => teachers.id, { onDelete: "cascade" }),
  mode: gatewayMode("mode").notNull().default("sandbox"),
  username: text("username").notNull(),
  appKey: text("app_key").notNull(),
  passwordSealed: text("password_sealed").notNull(),
  appSecretSealed: text("app_secret_sealed").notNull(),
  /** Offered to students: true once bKash has accepted the account. */
  enabled: boolean("enabled").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  idTokenSealed: text("id_token_sealed"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  refreshTokenSealed: text("refresh_token_sealed"),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
  /** When new tokens were last asked for (ISO times, the last two): bKash blocks a third within the hour. */
  tokenCalls: jsonb("token_calls").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** A notice on the teacher's website: a class moved, results out, admissions open. */
export const notices = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** As plain text: older notices' only copy, and what previews use. */
    body: text("body").notNull().default(""),
    /** The body as the editor wrote it (src/lib/rich-text.ts); shown when present. */
    bodyRich: jsonb("body_rich").$type<RichDoc>(),
    pinned: boolean("pinned").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("notices_teacher_published_idx").on(t.teacherId, t.publishedAt)],
);

/**
 * A class in the teacher's question bank, named by the teacher: "দশম শ্রেণি", "এইচএসসি ২০২৬ ব্যাচ".
 * `number` (from teachers.class_counter, never reused) is its website address,
 * lecturer.bd/<handle>/bank/<number>. Classes made before teachers named their own (migration
 * 0007) keep the fixed-list key they came from in `legacyGrade`, so an old address such as
 * /bank/hsc still finds them.
 */
export const bankClasses = pgTable(
  "bank_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    legacyGrade: text("grade"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bank_classes_teacher_number_key").on(t.teacherId, t.number),
    uniqueIndex("bank_classes_teacher_grade_key").on(t.teacherId, t.legacyGrade),
  ],
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
    classId: uuid("class_id")
      .notNull()
      .references(() => bankClasses.id),
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
    index("bank_subjects_class_idx").on(t.classId),
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
    /** The last sub-chapter number handed out in this chapter. */
    topicCounter: integer("topic_counter").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bank_chapters_subject_number_key").on(t.subjectId, t.number),
    index("bank_chapters_subject_position_idx").on(t.subjectId, t.position),
    index("bank_chapters_teacher_idx").on(t.teacherId),
  ],
);

/**
 * A chapter's sub-chapters (৪.১ বল ও গতির সূত্র…), in the teacher's order. A question may be filed
 * under one; the chapter page filters by it. `number` is never reused within the chapter, so
 * `?sub=<number>` links keep working; what pages show ("৪.১") follows the order.
 */
export const bankTopics = pgTable(
  "bank_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => bankChapters.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bank_topics_chapter_number_key").on(t.chapterId, t.number),
    index("bank_topics_chapter_position_idx").on(t.chapterId, t.position),
    index("bank_topics_teacher_idx").on(t.teacherId),
  ],
);

// In the database's own order: "textbook" was "problem" until migration 0003 renamed it.
export const questionType = pgEnum("question_type", ["mcq", "mcq_multi", "short", "creative", "textbook", "practice"]);
/**
 * Who sees a question on the website: everyone (public), only the teacher (private), or only the
 * teacher's students who are in a course (enrolled; everyone else sees that it exists, not what it says).
 */
export const questionVisibility = pgEnum("question_visibility", ["public", "private", "enrolled"]);

export type QuestionImage = { mediaId: string; url: string };
/** One part of a creative question (ক, খ, গ, ঘ) with its marks and, optionally, a worked answer. */
export type CreativePart = { text: RichText; marks: number; solution: RichText };

/**
 * What a question says. Which fields are used depends on the question's type (validated in
 * src/lib/questions.ts). Its text is rich text (src/lib/rich-text.ts): a document from the editor,
 * or plain text written before it, with maths as $…$ or $$…$$. `image` is the one picture a
 * question had before pictures went into the text; the editor moves it into the stem.
 *   mcq        stem, options[4], answer, explanation
 *   mcq_multi  stem, statements[2–4], prompt, options[4], answer, explanation
 *   short      stem, modelAnswer
 *   creative   stem (the উদ্দীপক), parts[4]
 *   textbook   stem, finalAnswer, solution   (a numerical problem from the textbook)
 *   practice   stem, finalAnswer, solution   (an extra numerical problem to practise)
 */
export type QuestionBody = {
  stem: RichText;
  image?: QuestionImage | null;
  statements?: RichText[];
  prompt?: string;
  options?: RichText[];
  /** Index of the correct option, 0–3. */
  answer?: number;
  explanation?: RichText;
  modelAnswer?: RichText;
  parts?: CreativePart[];
  /** A problem's result on its own, e.g. "৫ m s⁻²". */
  finalAnswer?: RichText;
  solution?: RichText;
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
    /** A sub-chapter of its chapter, or null. Deleting the sub-chapter leaves the question in the chapter. */
    topicId: uuid("topic_id").references(() => bankTopics.id, { onDelete: "set null" }),
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
    index("questions_topic_idx").on(t.topicId),
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

export const examStatus = pgEnum("exam_status", ["draft", "published"]);
/** When students see their result: as soon as they submit, or once the exam's window has closed. */
export const examResults = pgEnum("exam_results", ["immediate", "after_end"]);

/**
 * An online MCQ exam for a course's students (or one batch of it). A student may start any time
 * between `startsAt` and `endsAt`, and has `durationMin` minutes, never past `endsAt`: a "live"
 * exam is simply one whose window is as long as its duration. A draft can be changed freely; once
 * published its questions are frozen (`exam_questions.snapshot`), and once anyone has started, its
 * questions and marking can't change.
 */
export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Only this batch of the course sits it; null for every active student of the course. */
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    /** From teachers.exam_counter; never reused. */
    number: integer("number").notNull(),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    /** Marks for a right answer, in hundredths (100 = one mark). */
    markHundredths: integer("mark_hundredths").notNull().default(100),
    /** Marks taken off for a wrong answer, in hundredths (25 = a quarter mark); 0 for none. */
    negativeHundredths: integer("negative_hundredths").notNull().default(0),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(true),
    shuffleOptions: boolean("shuffle_options").notNull().default(false),
    results: examResults("results").notNull().default("after_end"),
    /** Whether students see, after their result, which option was right and why. */
    showAnswers: boolean("show_answers").notNull().default(true),
    status: examStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("exams_teacher_number_key").on(t.teacherId, t.number), index("exams_course_idx").on(t.courseId, t.startsAt)],
);

/** An MCQ as an exam keeps it: the question's type and body as they were, so later edits in the bank change nothing. */
export type ExamQuestionSnapshot = { type: "mcq" | "mcq_multi"; body: QuestionBody };

/** A question of an exam, in the teacher's order. `snapshot` is filled when the exam is published. */
export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    /** The bank question it came from; kept as null if that question is deleted later. */
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    snapshot: jsonb("snapshot").$type<ExamQuestionSnapshot>(),
  },
  (t) => [index("exam_questions_exam_idx").on(t.examId, t.position), uniqueIndex("exam_questions_exam_question_key").on(t.examId, t.questionId)],
);

/** A student's place in a student's attempt: the order they see the questions in, and each question's options. */
export type AttemptOrder = { questions: string[]; options: Record<string, number[]> };

/**
 * One student's sitting of one exam. `answers` maps an exam question's id to the option chosen
 * (its index in the question as written, not as shuffled). Scored when submitted, or when the
 * deadline has passed without a submission.
 */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    /** The earlier of the start plus the exam's duration, and the end of its window. */
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
    order: jsonb("order").$type<AttemptOrder>().notNull(),
    correct: integer("correct"),
    wrong: integer("wrong"),
    skipped: integer("skipped"),
    scoreHundredths: integer("score_hundredths"),
  },
  (t) => [uniqueIndex("attempts_exam_student_key").on(t.examId, t.studentId), index("attempts_teacher_idx").on(t.teacherId)],
);

/** A paper being put together, or final: its questions (and so its sets and answer keys) frozen. */
export const paperStatus = pgEnum("paper_status", ["draft", "final"]);
/** Where a question sits on a paper: the MCQs, answered on an OMR sheet, or the written part. */
export const paperSection = pgEnum("paper_section", ["mcq", "written"]);

/** What a printed paper says at its top, as the teacher typed it. Any of it may be left empty. */
export type PaperHeader = {
  institution: string;
  subject: string;
  className: string;
  date: string;
  duration: string;
  fullMarks: string;
  instructions: string;
};

/**
 * A question paper to print, for a course's students (or one batch of it): MCQs, answered on an
 * OMR sheet, and a written part. The MCQs come in sets, coded from `firstSet` on (three digits, as
 * the OMR sheet's set-code grid reads them): the first set in the teacher's order, every other one
 * shuffled from `seed` and its code, so a set comes out the same however often it is printed.
 * Once final, the questions are frozen (`paper_questions.snapshot`), and the sets with them.
 */
export const papers = pgTable(
  "papers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Only this batch of the course sits it; null for every active student of the course. */
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    /** From teachers.paper_counter; never reused. */
    number: integer("number").notNull(),
    title: text("title").notNull(),
    header: jsonb("header").$type<PaperHeader>().notNull(),
    setCount: integer("set_count").notNull().default(1),
    firstSet: integer("first_set").notNull().default(101),
    /** Picked at random when the paper is made; with a set's code it decides that set's order. */
    seed: integer("seed").notNull(),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(true),
    shuffleOptions: boolean("shuffle_options").notNull().default(false),
    /** Marks for a right MCQ answer, in hundredths (100 = one mark). */
    markHundredths: integer("mark_hundredths").notNull().default(100),
    /** Marks taken off for a wrong one, in hundredths; 0 for none. */
    negativeHundredths: integer("negative_hundredths").notNull().default(0),
    status: paperStatus("status").notNull().default("draft"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    /** When the teacher let students see their results; null while they can't. */
    resultsPublishedAt: timestamp("results_published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("papers_teacher_number_key").on(t.teacherId, t.number), index("papers_course_idx").on(t.courseId)],
);

/** A question as a paper keeps it: its type and body as they were when the paper was made final. */
export type PaperQuestionSnapshot = { type: (typeof questionType.enumValues)[number]; body: QuestionBody };

/** A question of a paper, in the teacher's order within its section. `snapshot` is filled when the paper is made final. */
export const paperQuestions = pgTable(
  "paper_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    /** The bank question it came from; kept as null if that question is deleted later. */
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    section: paperSection("section").notNull(),
    position: integer("position").notNull().default(0),
    snapshot: jsonb("snapshot").$type<PaperQuestionSnapshot>(),
  },
  (t) => [index("paper_questions_paper_idx").on(t.paperId, t.section, t.position), uniqueIndex("paper_questions_paper_question_key").on(t.paperId, t.questionId)],
);

/** How a sheet's marks came in: typed by the teacher, or read by the OMR Scanner app. */
export const paperResultSource = pgEnum("paper_result_source", ["manual", "scanner"]);

/**
 * One answer sheet of a final paper: the roll on it (who that is comes from the course's rolls
 * whenever it is read), its set, and what was marked on each MCQ, in the OMR app's mark string,
 * so a scanned sheet and a typed one are kept alike. Its counts and score are worked out on the
 * server from those marks and that set's key, never taken as sent.
 */
export const paperResults = pgTable(
  "paper_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    /** Digits, without leading zeros, as rolls are kept. */
    roll: text("roll").notNull(),
    setCode: integer("set_code").notNull(),
    /** One token per MCQ, comma separated: "2" option 2 · "-" blank · "d1.3" two marks. See src/lib/omr.ts. */
    marks: text("marks").notNull().default(""),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
    blank: integer("blank").notNull().default(0),
    /** Questions with two or more bubbles filled: wrong, under the board's rule. */
    doubled: integer("doubled").notNull().default(0),
    /** The MCQ score, in hundredths of a mark. */
    scoreHundredths: integer("score_hundredths").notNull().default(0),
    /** The written part's marks as the teacher gives them, in hundredths; null until given. */
    writtenHundredths: integer("written_hundredths"),
    source: paperResultSource("source").notNull().default("manual"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("paper_results_paper_roll_key").on(t.paperId, t.roll), index("paper_results_teacher_idx").on(t.teacherId)],
);
