import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

/** What the teacher's own website shows beyond the account fields. Filled in from Phase 2. */
export type TeacherSite = Record<string, unknown>;

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
