"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A button for something this preview doesn't do yet (sign-in, the Bangla version).
 * Clicking it still answers: a short note appears under it and is read out by screen readers.
 */
export function SoonButton({ children, note, className }: { children: ReactNode; note: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={className}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          setOpen(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setOpen(false), 2600);
        }}
      >
        {children}
      </button>
      <span
        id={id}
        role="status"
        className={cx(
          "absolute right-0 top-full z-30 mt-2 w-max max-w-[240px] rounded-[10px] bg-ink px-3 py-2 text-[13px] leading-snug font-medium text-white shadow-[0_8px_24px_rgba(23,25,28,0.18)] transition-opacity duration-150",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {open ? note : ""}
      </span>
    </span>
  );
}
