"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * A class's card on "নতুন শ্রেণি", and a submit button of the form around the cards: the card
 * picked says it is being added while the others wait.
 */
export function AddClassButton({ grade, add, adding, children }: { grade: string; add: string; adding: string; children: ReactNode }) {
  const { pending, data } = useFormStatus();
  const busy = pending && data?.get("grade") === grade;
  return (
    <button
      type="submit"
      name="grade"
      value={grade}
      disabled={pending}
      aria-busy={busy || undefined}
      className="flex min-h-[170px] cursor-pointer flex-col items-start gap-3.5 rounded-2xl border border-qb-line bg-qb-surface p-[22px] text-left text-qb-ink hover:border-qb-accent disabled:cursor-wait"
    >
      {children}
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-qb-accent">
        {busy ? (
          <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : (
          <span aria-hidden="true" className="text-[20px] leading-none">
            +
          </span>
        )}
        {busy ? adding : add}
      </span>
    </button>
  );
}
