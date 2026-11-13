import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/bank-ui";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getBankClass } from "@/server/bank";
import { getDb } from "@/server/db";
import { ClassForm } from "../../../class-forms";

export const instant = false;

export const metadata: Metadata = { title: "শ্রেণির নাম বদলান" };

/** A class's name, changed; its subjects and its website address stay as they are. */
export default async function RenameClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const teacher = await requireTeacher();
  const { classId } = await params;
  const bankClass = await getBankClass(await getDb(), teacher.id, classId);
  if (!bankClass) notFound();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.bank;

  return (
    <main className="dash-content max-w-[820px]">
      <Crumbs
        className="crumbs !pt-0"
        label={d.common.breadcrumb}
        items={[
          { label: t.title, href: "/dashboard/bank" },
          { label: bankClass.name, href: `/dashboard/bank/class/${bankClass.id}` },
          { label: t.renameClass },
        ]}
      />
      <h1 className="page-title">{t.renameClass}</h1>
      <ClassForm bankClass={{ id: bankClass.id, name: bankClass.name }} t={t.classForm} c={d.common} />
    </main>
  );
}
