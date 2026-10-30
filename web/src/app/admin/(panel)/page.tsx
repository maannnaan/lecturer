import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { initialOf } from "@/components/logo";
import { type Dictionary, type Locale, formatDate, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/current";
import { getDb } from "@/server/db";
import {
  TEACHER_STATUSES,
  type Teacher,
  type TeacherStatus,
  countTeachersByStatus,
  listTeachers,
} from "@/server/teachers";
import { decideTeacherAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "শিক্ষক · অ্যাডমিন" };

function isStatus(value: unknown): value is TeacherStatus {
  return (TEACHER_STATUSES as readonly unknown[]).includes(value);
}

export default async function AdminTeachersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: asked } = await searchParams;
  const status: TeacherStatus = isStatus(asked) ? asked : "pending";
  const db = await getDb();
  const [counts, teachers] = await Promise.all([countTeachersByStatus(db), listTeachers(db, status)]);
  const locale = await getLocale();
  const d = getDictionary(locale);
  const a = d.admin;

  return (
    <main className="wrap flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-3xl">{a.title}</h1>
        <p className="mt-1 text-ink-2">{a.lead}</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label={a.title}>
        {TEACHER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`btn btn-sm ${s === status ? "btn-primary" : "btn-ghost"}`}
          >
            {a.tabs[s]}
            <span className="font-num opacity-80">{formatNumber(counts[s], locale)}</span>
          </Link>
        ))}
      </nav>
      {teachers.length === 0 ? (
        <p className="card p-6 text-ink-2">{a.empty[status]}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} d={d} locale={locale} />
          ))}
        </ul>
      )}
    </main>
  );
}

function TeacherCard({ teacher, d, locale }: { teacher: Teacher; d: Dictionary; locale: Locale }) {
  const a = d.admin;
  const details = [teacher.phone, teacher.email, teacher.subjects, teacher.institution].filter(Boolean);
  return (
    <li className="card flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 gap-4">
        <span className="brand-mark">{initialOf(teacher.nameBn)}</span>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink">
            {teacher.nameBn} <span className="font-normal text-muted">· {teacher.nameEn}</span>
          </p>
          <Link href={`/${teacher.handle}`} className="link text-[15px]">
            lecturer.bd/{teacher.handle}
            <ExternalLink aria-hidden="true" />
          </Link>
          <p className="mt-1 text-[15px] break-words text-ink-2">{details.join(" · ")}</p>
          <p className="mt-1 text-sm text-muted">
            {a.registered}: {formatDate(teacher.createdAt, locale)}
          </p>
          {teacher.statusNote && <p className="mt-2 text-sm text-ink-2">“{teacher.statusNote}”</p>}
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:w-[300px]">
        {teacher.status !== "approved" && (
          <Decision teacher={teacher} decision={teacher.status === "suspended" ? "reinstate" : "approve"} label={teacher.status === "suspended" ? a.reinstate : a.approve} primary />
        )}
        {teacher.status === "pending" && <Decision teacher={teacher} decision="reject" label={a.reject} note={a.notePlaceholder} />}
        {teacher.status === "approved" && <Decision teacher={teacher} decision="suspend" label={a.suspend} note={a.notePlaceholder} />}
      </div>
    </li>
  );
}

function Decision({
  teacher,
  decision,
  label,
  note,
  primary = false,
}: {
  teacher: Teacher;
  decision: "approve" | "reinstate" | "reject" | "suspend";
  label: string;
  note?: string;
  primary?: boolean;
}) {
  return (
    <form action={decideTeacherAction} className="flex gap-2">
      <input type="hidden" name="teacherId" value={teacher.id} />
      <input type="hidden" name="decision" value={decision} />
      {note && (
        <input name="note" className="input !h-10 min-w-0 flex-1 text-[15px]" placeholder={note} aria-label={note} />
      )}
      <button type="submit" className={`btn btn-sm ${primary ? "btn-primary flex-1" : "btn-danger"}`}>
        {label}
      </button>
    </form>
  );
}
