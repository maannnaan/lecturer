import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderTex } from "@/components/math-text";
import { RichView } from "@/components/rich-view";
import type { RichDoc } from "@/lib/rich-text";

// Rich text as pages draw it: <RichView> rendered on the server, as students receive it.
const html = (props: Partial<Parameters<typeof RichView>[0]> & { value: Parameters<typeof RichView>[0]["value"] }) =>
  renderToStaticMarkup(createElement(RichView, { math: renderTex, ...props }));

const IMAGE = "6f1c2d3e-4a5b-4c6d-8e7f-001122334455";
const doc = (...content: unknown[]) => ({ type: "doc", content }) as RichDoc;
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, ...marks: string[]) => ({ type: "text", text: value, marks: marks.map((type) => ({ type })) });

describe("rich text on a page", () => {
  it("draws marks, lists, tables, pictures and maths", () => {
    const out = html({
      value: doc(
        p(text("H"), text("2", "subscript"), text("O ", "bold"), text("x", "italic"), text("2", "superscript"), text(" u", "underline")),
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("তিন"))] }] },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 2 }, content: [p(text("বল"))] }] }] },
        { type: "image", attrs: { src: "/media/t/1.jpg", mediaId: IMAGE, alt: "চিত্র" } },
        { type: "blockMath", attrs: { latex: "\\frac{a}{b}" } },
        p({ type: "inlineMath", attrs: { latex: "F = ma" } }),
      ),
    });
    expect(out).toContain("H<sub>2</sub><strong>O </strong><em>x</em><sup>2</sup><u> u</u>");
    expect(out).toContain('<ol start="3"><li><p>তিন</p></li></ol>');
    // React writes the attribute as colSpan; HTML attribute names are case-insensitive.
    expect(out).toMatch(/<div class="rich-table"><table><tbody><tr><th colspan="2"><p>বল<\/p><\/th><\/tr><\/tbody><\/table><\/div>/i);
    expect(out).toContain('<img src="/media/t/1.jpg" alt="চিত্র" class="rich-img"');
    expect(out).toMatch(/class="math-display"><span class="katex-display">/);
    expect(out).toMatch(/class="math-inline"><span class="katex">/);
  });

  it("draws a resized picture at its width, with no height, so it keeps its shape", () => {
    const out = html({ value: doc({ type: "image", attrs: { src: "/media/t/1.jpg", mediaId: IMAGE, width: 240 } }) });
    expect(out).toContain('<img src="/media/t/1.jpg" alt="" width="240" class="rich-img rich-img-sized"');
    expect(out).not.toContain("height");
  });

  it("places a picture left or right, for the text after it to sit beside it", () => {
    const out = html({ value: doc({ type: "image", attrs: { src: "/media/t/1.jpg", mediaId: IMAGE, width: 160, align: "right" } }, p(text("পাশের লেখা"))) });
    expect(out).toContain('class="rich-img rich-img-sized rich-img-right"');
    expect(html({ value: doc({ type: "image", attrs: { src: "/x.jpg", mediaId: IMAGE, align: "left" } }) })).toContain('class="rich-img rich-img-left"');
  });

  it("escapes words, so nothing typed becomes HTML", () => {
    const out = html({ value: doc(p(text('<img src=x onerror="alert(1)">'))) });
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(out).not.toContain("<img src=x");
  });

  it("reads $…$ in question text as maths, but keeps a website text's dollar signs", () => {
    expect(html({ value: doc(p(text("বল $F$"))) })).toContain('class="katex"');
    expect(html({ value: doc(p(text("৳১০ বা $10 থেকে $20"))), dollars: false })).toContain("৳১০ বা $10 থেকে $20");
  });

  it("draws an inline field as lines inside a span, fit for a button", () => {
    const out = html({ value: doc(p(text("ক")), p(text("খ"))), inline: true });
    expect(out).toBe('<span class="rich rich-inline">ক<br/>খ</span>');
  });

  it("draws older plain text as it always was, line breaks and maths included", () => {
    expect(html({ value: "প্রথম\nদ্বিতীয়" })).toBe('<span class="math-text">প্রথম\nদ্বিতীয়</span>');
    expect(html({ value: "$x$" })).toContain('class="katex"');
    expect(html({ value: "" })).toBe("");
  });

  it("shows a formula's code until the browser's KaTeX has loaded", () => {
    expect(html({ value: doc(p({ type: "inlineMath", attrs: { latex: "x^2" } })), math: null })).toContain("<code>x^2</code>");
  });
});
