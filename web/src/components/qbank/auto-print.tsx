"use client";

import { useEffect } from "react";

/** Opens the print dialog once the sheet's fonts are in ("Save as PDF" there downloads it). */
export function QbAutoPrint() {
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

/** "Print again", for when the dialog was closed. */
export function QbPrintButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
