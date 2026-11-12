"use client";

import { useEffect, useState } from "react";

type Katex = typeof import("katex").default;

let loading: Promise<Katex> | null = null;

/** KaTeX, loaded once and only by pages that preview maths (the question editor's live preview). */
export function useKatex(): Katex | null {
  const [katex, setKatex] = useState<Katex | null>(null);
  useEffect(() => {
    let alive = true;
    loading ??= import("katex").then((m) => m.default);
    loading.then((k) => alive && setKatex(() => k)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return katex;
}
