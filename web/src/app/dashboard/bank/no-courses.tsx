import Link from "next/link";
import { Plus } from "lucide-react";
import type { Dictionary } from "@/i18n";

/** The bank before the first course: questions are filed under a course's chapters. */
export function NoCourses({ t }: { t: Dictionary["dashboard"]["bank"] }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-6">
      <p className="text-ink-2">{t.noCourses}</p>
      <Link href="/dashboard/courses/new" className="btn btn-primary btn-sm">
        <Plus aria-hidden="true" />
        {t.createCourse}
      </Link>
    </div>
  );
}
