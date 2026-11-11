import type { Metadata } from "next";
import { Crumbs } from "@/components/bank-ui";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { ClassForm } from "../../class-forms";

export const instant = false;

export const metadata: Metadata = { title: "নতুন শ্রেণি" };

/** "নতুন শ্রেণি": a class named the way the teacher likes; saving it opens it, for its first subject. */
export default async function NewClassPage() {
  await requireTeacher();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.bank;

  return (
    <main className="dash-content max-w-[820px]">
      <Crumbs className="crumbs !pt-0" label={d.common.breadcrumb} items={[{ label: t.title, href: "/dashboard/bank" }, { label: t.newClass }]} />
      <div>
        <h2 className="text-2xl">{t.newClass}</h2>
        <p className="mt-1 text-ink-2">{t.classForm.lead}</p>
      </div>
      <ClassForm t={t.classForm} c={d.common} />
    </main>
  );
}
