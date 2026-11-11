import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { groupTabs, subjectCard } from "@/components/qbank/build";
import { QbCrumbs } from "@/components/qbank/ui";
import { type QbCtx, QbClassView } from "@/components/qbank/views";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSite, getSiteBank, getSiteClasses, getSiteSubjects } from "../../data";

export const instant = false;

type Params = Promise<{ handle: string; classNo: string }>;

/** The class behind lecturer.bd/<handle>/bank/<number>, or null. */
async function getPageClass(handle: string, classNo: string) {
  const site = await getSite(handle.toLowerCase());
  if (!site || !/^\d{1,6}$/.test(classNo)) return null;
  const bankClass = (await getSiteClasses(site.teacher.id)).find((c) => c.number === Number(classNo));
  return bankClass ? { teacher: site.teacher, bankClass } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, classNo } = await params;
  const found = await getPageClass(handle, classNo);
  if (!found || found.teacher.status !== "approved") return { robots: { index: false } };
  const { teacher, bankClass } = found;
  const d = getDictionary(await getLocale(teacher.locale));
  const empty = !(await getSiteBank(teacher.id)).some((g) => g.bankClass.id === bankClass.id);
  return {
    title: { absolute: `${bankClass.name} · ${d.site.bank.title} — ${teacher.nameBn}` },
    alternates: { canonical: `/${teacher.handle}/bank/${bankClass.number}` },
    robots: empty ? { index: false } : undefined,
  };
}

/** The website's question bank, second level: one class's subjects that have questions. */
export default async function SiteBankClassPage({ params }: { params: Params }) {
  const { handle, classNo } = await params;
  const found = await getPageClass(handle, classNo);
  if (!found) notFound();
  const { teacher, bankClass } = found;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const b = d.site.bank;
  const ctx: QbCtx = { d, locale, voice: d.site.chapter.qb, titleAs: "h1" };
  const [tree, all] = await Promise.all([getSiteBank(teacher.id), getSiteSubjects(teacher.id)]);
  const node = tree.find((g) => g.bankClass.id === bankClass.id);
  const home = `/${teacher.handle}`;
  const path = `${home}/bank/${bankClass.number}`;
  const subjects = (node?.subjects ?? []).map((s) => subjectCard(s, `${path}/${s.subject.number}`, all, d, locale, b.chapters));

  return (
    <QbClassView
      ctx={ctx}
      crumbs={
        <QbCrumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: b.title, href: `${home}/bank` },
            { label: bankClass.name },
          ]}
        />
      }
      title={bankClass.name}
      current={bankClass.id}
      classes={tree.map((g) => ({ id: g.bankClass.id, name: g.bankClass.name, href: `${home}/bank/${g.bankClass.number}` }))}
      groups={groupTabs(subjects, d)}
      subjects={subjects}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{b.emptyGrade}</p>}
    />
  );
}
