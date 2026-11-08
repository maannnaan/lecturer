import { Atom, Sigma } from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { ThemeName } from "@/lib/themes";

/**
 * A small drawing of a teacher's website inside a browser frame, for the landing page. It's
 * plain markup under its own data-style, so the real theme tokens draw it and it never goes
 * stale the way a screenshot would. Decorative only: screen readers skip it.
 */
export function SiteMockup({
  theme,
  m,
  compact = false,
}: {
  theme: ThemeName;
  m: Dictionary["landing"]["mock"];
  compact?: boolean;
}) {
  const icons = [Atom, Sigma];
  return (
    <div className="browser" data-style={theme} aria-hidden="true">
      <div className="browser-bar">
        <span className="browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="browser-url">lecturer.bd/{m.handle}</span>
      </div>
      <div className="mock">
        <div className="mock-nav">
          <span className="mock-mark">{m.initial}</span>
          <b>{m.name}</b>
          <span className="mock-links">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="mock-hero">
          <div className="min-w-0">
            <span className="mock-role">{m.role}</span>
            <span className="mock-h">{m.name}</span>
            {!compact && <span className="mock-lead">{m.lead}</span>}
            <span className="mock-btn">{m.button}</span>
          </div>
          <span className="mock-portrait">{m.initial}</span>
        </div>
        <div className="mock-courses">
          {m.courses.map((c, i) => {
            const Icon = icons[i % icons.length];
            return (
              <div key={c.title} className="mock-course">
                <div className={`course-cover mock-cover cv-${i + 1}`}>
                  <span className="lvl">{c.level}</span>
                  <Icon />
                </div>
                <div className="mock-course-body">
                  <b>{c.title}</b>
                  <span>{c.price}</span>
                </div>
              </div>
            );
          })}
        </div>
        {!compact && (
          <div className="mock-notice">
            <span className="date-block">
              <b>{m.noticeDay}</b>
              <span>{m.noticeMonth}</span>
            </span>
            <b>{m.notice}</b>
          </div>
        )}
      </div>
    </div>
  );
}
