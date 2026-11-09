import katex from "katex";
import { Fragment } from "react";
import { splitMath } from "@/lib/math";

/** KaTeX's HTML for one formula. Bad TeX shows in red instead of breaking the page. */
export function renderTex(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    // Bangla inside \text{} and similar shouldn't produce console noise.
    strict: "ignore",
    output: "htmlAndMathml",
    trust: false,
  });
}

/**
 * Question text with its maths typeset on the server, so students download no maths library.
 * Plain text is escaped by React; only KaTeX's own output is inserted as HTML. Line breaks are kept.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className ? `math-text ${className}` : "math-text"}>
      {splitMath(text).map((segment, i) =>
        segment.kind === "text" ? (
          <Fragment key={i}>{segment.value}</Fragment>
        ) : (
          <span
            key={i}
            className={segment.kind === "display" ? "math-display" : undefined}
            dangerouslySetInnerHTML={{ __html: renderTex(segment.tex, segment.kind === "display") }}
          />
        ),
      )}
    </span>
  );
}
