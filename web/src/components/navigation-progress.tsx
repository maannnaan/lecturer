"use client";

import { useEffect, useState } from "react";

/**
 * A thin bar across the top of the page while the next page is on its way, so a click never looks
 * ignored: links within the site, and search and filter forms. It appears only if the page takes
 * longer than a moment, and finishes when the address changes (or gives up after 15 seconds).
 * Buttons that save without leaving the page show their own spinner (PendingButton, SubmitButton).
 */
export function NavigationProgress() {
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    let from = "";
    let show = 0;
    let poll = 0;
    let giveUp = 0;
    let fade = 0;
    const stop = () => {
      window.clearTimeout(show);
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
    };
    const finish = () => {
      stop();
      setPhase((phase) => (phase === "busy" ? "done" : "idle"));
      fade = window.setTimeout(() => setPhase((phase) => (phase === "done" ? "idle" : phase)), 400);
    };
    const start = () => {
      stop();
      window.clearTimeout(fade);
      from = window.location.href;
      show = window.setTimeout(() => setPhase("busy"), 120);
      poll = window.setInterval(() => {
        if (window.location.href !== from) finish();
      }, 100);
      giveUp = window.setTimeout(finish, 15_000);
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const to = new URL(link.href, window.location.href);
      if (to.origin !== window.location.origin) return;
      // The same page, or only a #section of it: nothing to wait for.
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      start();
    };
    // A GET form (search, filters) loads a new page. Forms that save run a Server Action instead,
    // and React has already cancelled their default by the time this listener runs.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (event.defaultPrevented || !(form instanceof HTMLFormElement) || form.method !== "get") return;
      start();
    };
    const onPageShow = () => finish();

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      stop();
      window.clearTimeout(fade);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return <div className="nav-progress" data-phase={phase} aria-hidden="true" />;
}
