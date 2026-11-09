import Link from "next/link";
import { Plus } from "lucide-react";
import type { Dictionary } from "@/i18n";

/** The bank before its first subject: questions are filed under a subject's chapters. */
export function NoSubjects({ t, grade }: { t: Dictionary["dashboard"]["bank"]; grade?: string }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-6">
      <p className="text-ink-2">{t.noSubjects}</p>
      <Link href={`/dashboard/bank/subject/new${grade ? `?grade=${grade}` : ""}`} className="btn btn-primary btn-sm">
        <Plus aria-hidden="true" />
        {t.newSubject}
      </Link>
    </div>
  );
}
