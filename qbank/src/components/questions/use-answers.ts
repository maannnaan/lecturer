"use client";

import { useState } from "react";
import { OPTION_KEYS } from "@/lib/questions";
import type { Question } from "@/lib/types";

/**
 * Which answers are open (CQ, SQ) and which option was picked (MCQ), for one list of questions.
 * State stays put while the tab or the filters change, as in the mockup.
 */
export function useAnswers() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [picks, setPicks] = useState<Record<string, number>>({});
  // One polite announcement per list, so a screen reader hears the result of a pick once.
  const [announcement, setAnnouncement] = useState("");

  const isShown = (q: Question) => (q.type === "MCQ" ? q.id in picks : !!open[q.id]);

  return {
    open,
    picks,
    announcement,
    isShown,
    toggle(id: string) {
      setOpen((o) => ({ ...o, [id]: !o[id] }));
    },
    pick(q: Question, index: number, label: string) {
      if (q.id in picks) return;
      setPicks((p) => ({ ...p, [q.id]: index }));
      const right = OPTION_KEYS[q.correctIndex ?? 0];
      setAnnouncement(index === q.correctIndex ? `${label}: correct.` : `${label}: not quite. The answer is ${right}.`);
    },
    /** The mockup's "Show all / Hide all answers" (CQ, SQ) and "Reveal all / Reset answers" (MCQ). */
    toggleAll(list: Question[]) {
      const mcqs = list.filter((q) => q.type === "MCQ");
      const others = list.filter((q) => q.type !== "MCQ");
      const show = !toggleAllState(list, isShown).hide;
      setOpen((o) => {
        const next = { ...o };
        for (const q of others) next[q.id] = show;
        return next;
      });
      setPicks((p) => {
        const next = { ...p };
        for (const q of mcqs) {
          if (show) next[q.id] = q.correctIndex ?? 0;
          else delete next[q.id];
        }
        return next;
      });
      setAnnouncement(show ? "Answers shown." : "Answers hidden.");
    },
  };
}

/** What the toggle-all button does next, and its label. */
export function toggleAllState(list: Question[], isShown: (q: Question) => boolean): { hide: boolean; label: string } {
  const allMcq = list.length > 0 && list.every((q) => q.type === "MCQ");
  if (allMcq) {
    // As in the mockup: once any MCQ is answered the button resets them all.
    const any = list.some(isShown);
    return { hide: any, label: any ? "Reset answers" : "Reveal all answers" };
  }
  const all = list.length > 0 && list.every(isShown);
  return { hide: all, label: all ? "Hide all answers" : "Show all answers" };
}
