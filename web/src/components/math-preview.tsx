"use client";

import { Fragment, useEffect, useState } from "react";
import { splitMath } from "@/lib/math";

type Katex = typeof import("katex").default;

let loading: Promise<Katex> | null = null;

/** KaTeX, loaded once and only by pages that preview maths (the question editor). */
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

/** The browser twin of <MathText>: same splitting, same KaTeX options, for live previews. */
export function MathPreviewText({ text, katex, className }: { text: string; katex: Katex | null; className?: string }) {
  return (
    <span className={className ? `math-text ${className}` : "math-text"}>
      {splitMath(text).map((segment, i) => {
        if (segment.kind === "text") return <Fragment key={i}>{segment.value}</Fragment>;
        if (!katex) return <code key={i}>{segment.tex}</code>;
        const html = katex.renderToString(segment.tex, {
          displayMode: segment.kind === "display",
          throwOnError: false,
          strict: "ignore",
          output: "htmlAndMathml",
          trust: false,
        });
        return (
          <span key={i} className={segment.kind === "display" ? "math-display" : undefined} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </span>
  );
}
