import type { Metadata } from "next";
import { Pin, Trash2 } from "lucide-react";
import { formatDate, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listNotices } from "@/server/notices";
import { deleteNoticeAction } from "./actions";
import { EditNoticeForm, NewNoticeForm } from "./notice-forms";

export const instant = false;

export const metadata: Metadata = { title: "নোটিশ" };

export default async function NoticesPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.notices;
  const notices = await listNotices(await getDb(), teacher.id);

  return (
    <main className="dash-content">
      <header>
        <h2 className="text-2xl">{t.title}</h2>
        <p className="mt-1 text-ink-2">{t.lead}</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <NewNoticeForm t={t} c={d.common} />
        <section className="card p-5" aria-labelledby="notice-list-title">
          <h3 id="notice-list-title" className="panel-title">
            {t.title}
          </h3>
          {notices.length === 0 ? (
            <p className="mt-2 text-[15px] text-muted">{t.empty}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {notices.map((notice) => (
                <li key={notice.id} className="rounded-lg border border-line p-3">
                  <details>
                    <summary className="cursor-pointer list-none">
                      <span className="block text-[13px] text-muted">{formatDate(notice.publishedAt, locale)}</span>
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {notice.pinned && (
                          <span className="badge badge-warn">
                            <Pin aria-hidden="true" />
                            {t.pinnedBadge}
                          </span>
                        )}
                        {notice.title}
                      </span>
                    </summary>
                    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                      <EditNoticeForm notice={notice} t={t} c={d.common} />
                      <form action={deleteNoticeAction}>
                        <input type="hidden" name="noticeId" value={notice.id} />
                        <button type="submit" className="btn btn-danger btn-xs">
                          <Trash2 aria-hidden="true" />
                          {d.common.delete}
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
