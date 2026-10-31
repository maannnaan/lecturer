import { initialOf } from "@/components/logo";
import type { Dictionary } from "@/i18n";
import { THEMES, THEME_SWATCHES, type ThemeName } from "@/lib/themes";
import type { Teacher } from "@/server/teachers";
import { setThemeAction } from "./actions";

/** The three themes, each drawn as a small sample of the teacher's own site. */
export function ThemePicker({
  teacher,
  t,
  stacked = false,
}: {
  teacher: Teacher;
  t: Dictionary["dashboard"]["theme"];
  /** One theme per row, for a narrow column. */
  stacked?: boolean;
}) {
  return (
    <section className="card p-5" aria-labelledby="theme-title">
      <h3 id="theme-title" className="panel-title">
        {t.title}
      </h3>
      <p className="panel-lead">{t.lead}</p>
      <div className={`mt-5 grid gap-4 ${stacked ? "" : "md:grid-cols-3"}`}>
        {THEMES.map((theme) => (
          <ThemeOption key={theme} theme={theme} teacher={teacher} t={t} />
        ))}
      </div>
    </section>
  );
}

function ThemeOption({ theme, teacher, t }: { theme: ThemeName; teacher: Teacher; t: Dictionary["dashboard"]["theme"] }) {
  const inUse = teacher.theme === theme;
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border ${inUse ? "border-primary ring-2 ring-primary-soft" : "border-line"}`}
    >
      <div data-style={theme} className="flex flex-col gap-3 p-4" style={{ background: "var(--lb-hero-bg)" }} aria-hidden="true">
        <div className="flex items-center gap-2.5">
          {teacher.site.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload
            <img src={teacher.site.photo.url} alt="" className="brand-photo !size-9" />
          ) : (
            <span className="brand-mark !size-9 !text-base">{initialOf(teacher.nameBn)}</span>
          )}
          <span className="min-w-0 truncate font-head text-[17px] text-ink">{teacher.nameBn}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="btn btn-primary btn-xs">{teacher.handle}</span>
          {THEME_SWATCHES[theme].map((c) => (
            <i key={c} className="block size-3.5 rounded-full border border-line" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-line bg-surface p-4">
        <p className="font-semibold text-ink">{t.names[theme]}</p>
        <p className="flex-1 text-sm text-ink-2">{t.descriptions[theme]}</p>
        {inUse ? (
          <span className="badge badge-primary self-start">{t.inUse}</span>
        ) : (
          <form action={setThemeAction}>
            <input type="hidden" name="theme" value={theme} />
            <button type="submit" className="btn btn-ghost btn-xs">
              {t.use}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
