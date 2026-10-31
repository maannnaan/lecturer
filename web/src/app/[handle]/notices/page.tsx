import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSite, getSiteNotices } from "../data";
import { NoticeList, SectionHead } from "../site-ui";

export const instant = false;

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site || site.teacher.status !== "approved") return { robots: { index: false } };
  const locale = await getLocale(site.teacher.locale);
  return {
    title: { absolute: `${getDictionary(locale).site.noticesTitle} — ${site.teacher.nameBn}` },
    alternates: { canonical: `/${site.teacher.handle}/notices` },
  };
}

export default async function NoticesPage({ params }: { params: Params }) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const notices = await getSiteNotices(teacher.id);

  return (
    <main className="section">
      <div className="wrap max-w-[860px]">
        <SectionHead eyebrow={locale === "bn" ? teacher.nameBn : teacher.nameEn} title={d.site.noticesTitle} />
        {notices.length > 0 ? (
          <NoticeList notices={notices} d={d} locale={locale} />
        ) : (
          <p className="card p-6 text-ink-2">{d.site.noticesEmpty}</p>
        )}
      </div>
    </main>
  );
}
