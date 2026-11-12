import { describe, expect, it } from "vitest";
import type { FieldErrors } from "@/lib/form-input";
import {
  type RichDoc,
  richColumns,
  richField,
  richFromField,
  richImageIds,
  richPlain,
  richToDoc,
  richToField,
  textToDoc,
  withImageUrls,
} from "@/lib/rich-text";

const IMAGE = "6f1c2d3e-4a5b-4c6d-8e7f-001122334455";
const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, ...marks: string[]) => (marks.length ? { type: "text", text: value, marks: marks.map((type) => ({ type })) } : { type: "text", text: value });

/** What the field reads from the form, and the errors it records, for one posted document. */
function posted(value: unknown, options: Parameters<typeof richField>[4] = {}, max = 4000) {
  const errors: FieldErrors = {};
  const result = richField({ stem: typeof value === "string" ? value : JSON.stringify(value) }, "stem", max, errors, options);
  return { result, errors };
}

describe("rich text from the editor", () => {
  it("keeps the toolbar's nodes and marks, normalised", () => {
    const { result, errors } = posted(
      doc(
        p(text("H"), text("2", "subscript"), text("O ও "), text("x", "italic"), text("2", "superscript"), { type: "inlineMath", attrs: { latex: " F = ma " } }),
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("এক", "underline", "bold"))] }] },
        { type: "orderedList", attrs: { start: 3, type: null }, content: [{ type: "listItem", content: [p(text("তিন"))] }] },
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(text("বল"))] }] },
            { type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2, rowspan: 1 }, content: [p(text("১০ N"))] }] },
          ],
        },
        { type: "image", attrs: { src: "https://anywhere.example/x.png", mediaId: IMAGE, alt: "চিত্র", title: null, width: 10 } },
        { type: "blockMath", attrs: { latex: "\\frac{a}{b}" } },
      ),
    );
    expect(errors).toEqual({});
    expect(result).toEqual(
      doc(
        p(text("H"), text("2", "subscript"), text("O ও "), text("x", "italic"), text("2", "superscript"), { type: "inlineMath", attrs: { latex: "F = ma" } }),
        // Marks in a fixed order, whatever order they came in.
        { type: "bulletList", content: [{ type: "listItem", content: [p(text("এক", "bold", "underline"))] }] },
        { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("তিন"))] }] },
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", content: [p(text("বল"))] }] },
            { type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2 }, content: [p(text("১০ N"))] }] },
          ],
        },
        // Only what the page needs; the server points `src` at the stored file later. A width
        // too small to see is raised to the smallest allowed.
        { type: "image", attrs: { src: "https://anywhere.example/x.png", mediaId: IMAGE, alt: "চিত্র", width: 40 } },
        { type: "blockMath", attrs: { latex: "\\frac{a}{b}" } },
      ),
    );
  });

  it("keeps a resized picture's width, whole and within limits, but never its height", () => {
    const picture = (attrs: Record<string, unknown>) => posted(doc({ type: "image", attrs: { src: "", mediaId: IMAGE, ...attrs } })).result as RichDoc;
    expect(picture({ width: 320.6, height: 211 }).content[0]).toEqual({ type: "image", attrs: { src: "", mediaId: IMAGE, width: 321 } });
    expect(picture({ width: 99999 }).content[0]).toMatchObject({ attrs: { width: 1200 } });
    // Never resized: no width, so the page draws it at its own size.
    expect(picture({ width: null, height: null }).content[0]).toEqual({ type: "image", attrs: { src: "", mediaId: IMAGE } });
    expect(picture({ width: "300px" }).content[0]).toEqual({ type: "image", attrs: { src: "", mediaId: IMAGE } });
  });

  it("keeps where a picture sits, and only the known places", () => {
    const picture = (attrs: Record<string, unknown>) => posted(doc({ type: "image", attrs: { src: "", mediaId: IMAGE, ...attrs } })).result as RichDoc;
    expect(picture({ align: "left", width: 200 }).content[0]).toEqual({ type: "image", attrs: { src: "", mediaId: IMAGE, width: 200, align: "left" } });
    expect(picture({ align: "right" }).content[0]).toMatchObject({ attrs: { align: "right" } });
    expect(picture({ align: "center" }).content[0]).toMatchObject({ attrs: { align: "center" } });
    for (const align of [null, "justify", "left; position: fixed", 1]) {
      expect(picture({ align }).content[0]).toEqual({ type: "image", attrs: { src: "", mediaId: IMAGE } });
    }
  });

  it("refuses anything the editor never writes", () => {
    const refused = (value: unknown) => posted(value).errors.stem;
    expect(refused(doc({ type: "heading", content: [text("x")] }))).toBe("invalid");
    expect(refused(doc({ type: "codeBlock", content: [text("x")] }))).toBe("invalid");
    expect(refused(doc(p(text("x", "link"))))).toBe("invalid");
    expect(refused(doc(p({ type: "mention", attrs: { id: "1" } })))).toBe("invalid");
    // A picture that isn't one of the teacher's uploads (no media id) can't come in.
    expect(refused(doc({ type: "image", attrs: { src: "https://tracker.example/pixel.gif" } }))).toBe("invalid");
    expect(refused(doc({ type: "image", attrs: { src: "x", mediaId: "not-a-uuid" } }))).toBe("invalid");
    expect(refused({ type: "doc", content: "nope" })).toBe("invalid");
    expect(posted('{"type":"doc", broken').errors.stem).toBe("invalid");
  });

  it("drops attributes it doesn't know, so none reach a page", () => {
    const { result } = posted(doc(p({ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "bold", attrs: { onclick: "x" } }] })));
    // The words stay words: the renderer escapes them like any text.
    expect(result).toEqual(doc(p(text("<script>alert(1)</script>", "bold"))));
  });

  it("counts words and maths against the field's limit, and limits sizes", () => {
    expect(posted(doc(p(text("ক".repeat(11)))), {}, 10).errors.stem).toBe("tooLong");
    expect(posted(doc(p({ type: "inlineMath", attrs: { latex: "x".repeat(1001) } }))).errors.stem).toBe("tooLong");
    const deep = Array.from({ length: 20 }).reduce<unknown>((inner) => ({ type: "bulletList", content: [{ type: "listItem", content: [p(text("x")), inner] }] }), p(text("x")));
    expect(posted(doc(deep)).errors.stem).toBe("tooLong");
    const pictures = Array.from({ length: 13 }, () => ({ type: "image", attrs: { src: "", mediaId: IMAGE } }));
    expect(posted(doc(...pictures)).errors.stem).toBe("tooLong");
  });

  it("reads an empty document as empty, and trims blank lines at either end", () => {
    expect(posted(doc(p(), p(text("   ")), p())).result).toBe("");
    expect(posted(doc(p()), { required: true }).errors.stem).toBe("required");
    expect(posted(doc(p(), p(text("ক")), p(), p(text("খ")), p())).result).toEqual(doc(p(text("ক")), { type: "paragraph" }, p(text("খ"))));
    // A picture alone is something to show.
    expect(posted(doc({ type: "image", attrs: { src: "", mediaId: IMAGE } })).result).not.toBe("");
  });

  it("keeps an inline field (an MCQ option) to lines of text and maths", () => {
    expect(posted(doc(p(text("ক"), { type: "hardBreak" }, text("খ"))), { mode: "inline" }).errors).toEqual({});
    expect(posted(doc({ type: "bulletList", content: [{ type: "listItem", content: [p(text("x"))] }] }), { mode: "inline" }).errors.stem).toBe("invalid");
    expect(posted(doc({ type: "blockMath", attrs: { latex: "x" } }), { mode: "inline" }).errors.stem).toBe("invalid");
  });

  it("gives every list item and table cell the paragraph the editor needs first", () => {
    const { result } = posted(doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [] }] }] }), {});
    // An empty table holds nothing to show.
    expect(result).toBe("");
    const filled = posted(doc(p(text("x")), { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [] }] }] })).result as RichDoc;
    expect(filled.content[1]).toEqual({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }] });
  });

  it("still takes plain text, as older forms, tests and the seed post it", () => {
    expect(posted(" $F = ma$ ").result).toBe("$F = ma$");
    expect(posted("").result).toBe("");
    expect(posted("", { required: true }).errors.stem).toBe("required");
    expect(posted("ক".repeat(4001)).errors.stem).toBe("tooLong");
    // A stem that merely starts with a brace is plain text, not a broken document.
    expect(posted("{a, b, c} সেটটির উপাদান কয়টি?").result).toBe("{a, b, c} সেটটির উপাদান কয়টি?");
  });
});

describe("plain text from before the editor", () => {
  it("opens as paragraphs, line breaks and formulas", () => {
    expect(textToDoc("প্রথম লাইন\nদ্বিতীয় $x^2$\n\nনতুন অনুচ্ছেদ $$a = \\frac{F}{m}$$ শেষ")).toEqual(
      doc(
        p(text("প্রথম লাইন"), { type: "hardBreak" }, text("দ্বিতীয় "), { type: "inlineMath", attrs: { latex: "x^2" } }),
        p(text("নতুন অনুচ্ছেদ ")),
        { type: "blockMath", attrs: { latex: "a = \\frac{F}{m}" } },
        p(text(" শেষ")),
      ),
    );
    // In a line, a formula on its own line is an ordinary one; a website text keeps its dollars.
    expect(textToDoc("$$x$$", { mode: "inline" })).toEqual(doc(p({ type: "inlineMath", attrs: { latex: "x" } })));
    expect(textToDoc("$10 থেকে $20", { dollars: false })).toEqual(doc(p(text("$10 থেকে $20"))));
    expect(textToDoc("")).toEqual(doc({ type: "paragraph" }));
    expect(richToDoc(undefined)).toEqual(doc({ type: "paragraph" }));
  });
});

describe("rich text as plain text and back", () => {
  const sample = doc(
    p(text("বল "), { type: "inlineMath", attrs: { latex: "F" } }, { type: "hardBreak" }, text("পরের লাইন")),
    { type: "orderedList", content: [{ type: "listItem", content: [p(text("এক"))] }, { type: "listItem", content: [p(text("দুই"))] }] },
    { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p(text("ক"))] }, { type: "tableCell", content: [p(text("খ"))] }] }] },
    { type: "image", attrs: { src: "/old.png", mediaId: IMAGE } },
  ) as RichDoc;

  it("reads as plain text, maths as $…$, for descriptions and one-line lists", () => {
    expect(richPlain(sample)).toBe("বল $F$\nপরের লাইন\n\n1. এক\n2. দুই\n\nক | খ");
    expect(richPlain("আগের লেখা")).toBe("আগের লেখা");
    expect(richPlain(undefined)).toBe("");
  });

  it("finds its pictures and points them at their stored files", () => {
    expect(richImageIds(sample)).toEqual([IMAGE]);
    expect(richImageIds("plain")).toEqual([]);
    const fixed = withImageUrls(sample, new Map([[IMAGE, "/media/t/1.jpg"]])) as RichDoc;
    expect(fixed.content[3]).toEqual({ type: "image", attrs: { src: "/media/t/1.jpg", mediaId: IMAGE } });
    // The original is left alone.
    expect((sample.content[3] as { attrs: { src: string } }).attrs.src).toBe("/old.png");
  });

  it("goes back into a form and out again unchanged", () => {
    expect(richFromField(richToField(sample))).toEqual(sample);
    expect(richFromField("plain")).toBe("plain");
    expect(richFromField('{"type":"doc", broken')).toBe("");
    expect(richToField("")).toBe("");
  });

  it("is stored twice for a website text: plain for previews, the document to show", () => {
    expect(richColumns(sample, "body", "bodyRich")).toEqual({ body: richPlain(sample), bodyRich: sample });
    expect(richColumns("পুরোনো নোটিশ", "body", "bodyRich")).toEqual({ body: "পুরোনো নোটিশ", bodyRich: null });
  });
});
