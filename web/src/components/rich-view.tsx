import { Fragment, type ReactNode } from "react";
import { splitMath } from "@/lib/math";
import type { RichBlock, RichInline, RichMarkType, RichParagraph, RichText } from "@/lib/rich-text";

/** KaTeX's HTML for a formula; null while the browser is still loading KaTeX (the code shows meanwhile). */
export type MathRenderer = ((tex: string, display: boolean) => string) | null;

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

function formula(tex: string, display: boolean, math: MathRenderer, key?: number): ReactNode {
  if (!math) return display ? <pre key={key}>{tex}</pre> : <code key={key}>{tex}</code>;
  return (
    <span
      key={key}
      className={display ? "math-display" : "math-inline"}
      // KaTeX's own output (escaped by KaTeX, with trust off): the only HTML ever inserted.
      dangerouslySetInnerHTML={{ __html: math(tex, display) }}
    />
  );
}

/** Words with $…$ maths in them, the way teachers have always typed formulas. */
function withMath(text: string, math: MathRenderer): ReactNode {
  const segments = splitMath(text);
  if (segments.length === 1 && segments[0].kind === "text") return segments[0].value;
  return segments.map((segment, i) =>
    segment.kind === "text" ? <Fragment key={i}>{segment.value}</Fragment> : formula(segment.tex, segment.kind === "display", math, i),
  );
}

const MARK_TAGS: Record<RichMarkType, "strong" | "em" | "u" | "sub" | "sup"> = {
  bold: "strong",
  italic: "em",
  underline: "u",
  subscript: "sub",
  superscript: "sup",
};

/** How a document is drawn: its formulas' typesetter, and whether $…$ typed in its text is maths. */
type Draw = { math: MathRenderer; dollars: boolean };

function inlines(content: RichInline[] | undefined, draw: Draw): ReactNode[] {
  const { math } = draw;
  return (content ?? []).map((item, i) => {
    if (item.type === "hardBreak") return <br key={i} />;
    if (item.type === "inlineMath") return formula(item.attrs.latex, false, math, i);
    // Marks nest in a fixed order (bold outside, superscript inside), as the server stores them.
    const marked = (item.marks ?? []).reduceRight<ReactNode>(
      (inner, mark) => {
        const Tag = MARK_TAGS[mark.type];
        return <Tag>{inner}</Tag>;
      },
      draw.dollars ? withMath(item.text, math) : item.text,
    );
    return <Fragment key={i}>{marked}</Fragment>;
  });
}

function blocks(content: RichBlock[], draw: Draw): ReactNode[] {
  const { math } = draw;
  return content.map((block, i) => {
    switch (block.type) {
      case "paragraph":
        return <p key={i}>{block.content?.length ? inlines(block.content, draw) : <br />}</p>;
      case "bulletList":
        return (
          <ul key={i}>
            {block.content.map((li, j) => (
              <li key={j}>{blocks(li.content, draw)}</li>
            ))}
          </ul>
        );
      case "orderedList":
        return (
          <ol key={i} start={block.attrs?.start}>
            {block.content.map((li, j) => (
              <li key={j}>{blocks(li.content, draw)}</li>
            ))}
          </ol>
        );
      case "table":
        return (
          <div key={i} className="rich-table">
            <table>
              <tbody>
                {block.content.map((row, j) => (
                  <tr key={j}>
                    {row.content.map((cell, k) => {
                      const Cell = cell.type === "tableHeader" ? "th" : "td";
                      return (
                        <Cell key={k} colSpan={cell.attrs?.colspan} rowSpan={cell.attrs?.rowspan}>
                          {blocks(cell.content, draw)}
                        </Cell>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "image":
        return (
          // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload; its src is set by the server
          <img
            key={i}
            src={block.attrs.src}
            alt={block.attrs.alt ?? ""}
            width={block.attrs.width}
            className={block.attrs.width ? "rich-img rich-img-sized" : "rich-img"}
            loading="lazy"
            decoding="async"
          />
        );
      case "blockMath":
        return <div key={i}>{formula(block.attrs.latex, true, math)}</div>;
      default:
        return null;
    }
  });
}

/**
 * Rich text as it should look: a document from the editors, or older plain text with $…$ maths.
 * `inline` draws a field that sits in a line (an MCQ option) as lines inside a <span>, so it can
 * go where only phrasing content may, such as a button. Works on the server and in the browser;
 * `math` says how formulas are typeset there. `dollars` (question text) reads $…$ typed in the
 * text as maths; a notice's dollar signs stay dollar signs.
 */
export function RichView({
  value,
  math,
  inline = false,
  dollars = true,
  className,
}: {
  value: RichText | undefined | null;
  math: MathRenderer;
  inline?: boolean;
  dollars?: boolean;
  className?: string;
}) {
  if (!value) return null;
  const draw: Draw = { math, dollars };
  if (typeof value === "string") return <span className={cx("math-text", className)}>{dollars ? withMath(value, math) : value}</span>;
  if (inline) {
    const lines = value.content.filter((block): block is RichParagraph => block.type === "paragraph");
    return (
      <span className={cx("rich rich-inline", className)}>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {inlines(line.content, draw)}
          </Fragment>
        ))}
      </span>
    );
  }
  return <div className={cx("rich", className)}>{blocks(value.content, draw)}</div>;
}
