import type { Metadata } from "next";
import { QbCrumbs, QbTitle } from "@/components/qbank/ui";
import { QbClassNumber } from "@/components/qbank/views";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { GRADES, gradeName, gradeOf } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listBankClasses, listSubjects } from "@/server/bank";
import { getDb } from "@/server/db";
import { addClassAction } from "../../actions";
import { AddClassButton } from "../../class-forms";

export const instant = false;

export const metadata: Metadata = { title: "নতুন শ্রেণি" };

/** "নতুন শ্রেণি": the classes not in the bank yet, as cards; picking one adds it and opens it. */
export default async function NewClassPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const db = await getDb();
  const [subjects, classes] = await Promise.all([listSubjects(db, teacher.id), listBankClasses(db, teacher.id)]);
  const inBank = new Set<string>([...classes, ...subjects.map(gradeOf)]);
  const left = GRADES.filter((grade) => !inBank.has(grade));

  return (
    <main id="main" className="qb flex-1">
      <div className="qb-x @container flex flex-col gap-7 pt-8 pb-16">
        <QbCrumbs label={d.common.breadcrumb} items={[{ label: t.title, href: "/dashboard/bank" }, { label: t.newClass }]} />
        <div className="flex max-w-[760px] flex-col gap-1.5">
          <QbTitle as="h2" size="lg">
            {t.newClass}
          </QbTitle>
          <p className="m-0 text-[18px] text-qb-muted">{left.length > 0 ? t.classForm.lead : t.classForm.allAdded}</p>
        </div>
        {left.length > 0 && (
          <form
            action={addClassAction}
            aria-label={t.newClass}
            className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 @min-[640px]:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
          >
            {left.map((grade) => {
              const name = gradeName(grade, d);
              return (
                <AddClassButton key={grade} grade={grade} add={t.classForm.add} adding={t.classForm.adding}>
                  <span aria-hidden="true">
                    <QbClassNumber grade={grade} locale={locale} />
                  </span>
                  <span className="mt-auto flex flex-col gap-0.5">
                    <span className="text-[18px] font-bold">{name.label}</span>
                    <span className="text-[14px] text-qb-subtle">{name.detail}</span>
                  </span>
                </AddClassButton>
              );
            })}
          </form>
        )}
      </div>
    </main>
  );
}
