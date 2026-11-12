import { type FieldErrors, type Input, text as plainText } from "./form-input";
import { isUuid } from "./ids";
import { splitMath } from "./math";

// Rich text: what the editors (Tiptap) write, kept as a small JSON document of the same shape as
// Tiptap's getJSON(). Only the nodes and marks below exist. The server checks every document before
// it is stored, and pages draw it with our own renderer, never as HTML, so nothing a teacher
// pastes can run on a page. Text written before the editors (a plain string, maths as $…$) is
// still valid rich text and is drawn as it always was.

export const RICH_MARKS = ["bold", "italic", "underline", "subscript", "superscript"] as const;
export type RichMarkType = (typeof RICH_MARKS)[number];
export type RichMark = { type: RichMarkType };
export type RichInline =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "hardBreak" }
  | { type: "inlineMath"; attrs: { latex: string } };
export type RichParagraph = { type: "paragraph"; content?: RichInline[] };
export type RichListItem = { type: "listItem"; content: RichBlock[] };
export type RichCell = { type: "tableCell" | "tableHeader"; attrs?: { colspan?: number; rowspan?: number }; content: RichBlock[] };
export type RichRow = { type: "tableRow"; content: RichCell[] };
export type RichBlock =
  | RichParagraph
  | { type: "bulletList"; content: RichListItem[] }
  | { type: "orderedList"; attrs?: { start?: number }; content: RichListItem[] }
  | { type: "table"; content: RichRow[] }
  | { type: "image"; attrs: { src: string; mediaId: string; alt?: string; width?: number; align?: RichImageAlign } }
  | { type: "blockMath"; attrs: { latex: string } };
export type RichDoc = { type: "doc"; content: RichBlock[] };
/** A field's text: a rich document, or plain text from before the editors ("" when empty). */
export type RichText = string | RichDoc;

/**
 * "block" fields take everything the toolbar offers; "inline" ones (an MCQ's options and
 * statements, a problem's final answer) take lines of text and maths only, as they sit in a line.
 */
export type RichMode = "block" | "inline";

/** How an editor posts its document: JSON that starts like this, so plain text is never mistaken for it. */
export const RICH_PREFIX = '{"type":"doc"';

const MAX_JSON = 200_000;
const MAX_NODES = 4000;
const MAX_DEPTH = 12;
const MAX_LATEX = 1000;
const MAX_IMAGES = 12;
const MAX_CELLS = 400;
const MAX_SPAN = 20;
/** A resized picture's width, in CSS pixels: big enough to see, no wider than any page. */
export const MIN_IMAGE_WIDTH = 40;
export const MAX_IMAGE_WIDTH = 1200;
/**
 * Where a picture sits: on the left or right with the text that follows beside it, or centred on
 * its own line. Without one it stands alone on the left.
 */
export const RICH_IMAGE_ALIGNS = ["left", "right", "center"] as const;
export type RichImageAlign = (typeof RICH_IMAGE_ALIGNS)[number];
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

class Refused extends Error {
  constructor(readonly reason: "invalid" | "tooLong") {
    super(reason);
  }
}

type Budget = { mode: RichMode; maxText: number; nodes: number; text: number; images: number; cells: number };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Refused("invalid");
  return value as Record<string, unknown>;
}

function items(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Refused("invalid");
  return value;
}

function spend(budget: Budget, key: "nodes" | "text" | "images" | "cells", amount: number) {
  budget[key] += amount;
  const limit = key === "nodes" ? MAX_NODES : key === "text" ? budget.maxText : key === "images" ? MAX_IMAGES : MAX_CELLS;
  if (budget[key] > limit) throw new Refused("tooLong");
}

function cleanMarks(raw: unknown): RichMark[] {
  const found = new Set<RichMarkType>();
  for (const item of items(raw)) {
    const type = record(item).type;
    if (!RICH_MARKS.includes(type as RichMarkType)) throw new Refused("invalid");
    found.add(type as RichMarkType);
  }
  return RICH_MARKS.filter((type) => found.has(type)).map((type) => ({ type }));
}

function cleanLatex(raw: unknown, budget: Budget): string {
  const latex = record(raw).latex;
  if (typeof latex !== "string") throw new Refused("invalid");
  const value = latex.replace(CONTROL, "").trim();
  if ([...value].length > MAX_LATEX) throw new Refused("tooLong");
  spend(budget, "text", [...value].length);
  return value;
}

function cleanInline(raw: unknown, budget: Budget): RichInline[] {
  const out: RichInline[] = [];
  for (const item of items(raw)) {
    const node = record(item);
    spend(budget, "nodes", 1);
    if (node.type === "text") {
      if (typeof node.text !== "string") throw new Refused("invalid");
      const text = node.text.replace(CONTROL, "");
      if (!text) continue;
      spend(budget, "text", [...text].length);
      const marks = cleanMarks(node.marks);
      out.push(marks.length > 0 ? { type: "text", text, marks } : { type: "text", text });
    } else if (node.type === "hardBreak") {
      out.push({ type: "hardBreak" });
    } else if (node.type === "inlineMath") {
      const latex = cleanLatex(node.attrs, budget);
      if (latex) out.push({ type: "inlineMath", attrs: { latex } });
    } else {
      throw new Refused("invalid");
    }
  }
  return out;
}

function whole(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** A list item or table cell must start with a paragraph (the editor's schema says so). */
function startsWithParagraph(blocks: RichBlock[]): RichBlock[] {
  return blocks[0]?.type === "paragraph" ? blocks : [{ type: "paragraph" }, ...blocks];
}

function cleanBlocks(raw: unknown, budget: Budget, depth: number): RichBlock[] {
  if (depth > MAX_DEPTH) throw new Refused("tooLong");
  const out: RichBlock[] = [];
  for (const item of items(raw)) {
    const node = record(item);
    spend(budget, "nodes", 1);
    if (budget.mode === "inline" && node.type !== "paragraph") throw new Refused("invalid");
    switch (node.type) {
      case "paragraph": {
        const content = cleanInline(node.content, budget);
        out.push(content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" });
        break;
      }
      case "bulletList":
      case "orderedList": {
        const listItems: RichListItem[] = items(node.content).map((entry) => {
          const li = record(entry);
          spend(budget, "nodes", 1);
          if (li.type !== "listItem") throw new Refused("invalid");
          return { type: "listItem", content: startsWithParagraph(cleanBlocks(li.content, budget, depth + 1)) };
        });
        if (listItems.length === 0) break;
        if (node.type === "bulletList") {
          out.push({ type: "bulletList", content: listItems });
        } else {
          const start = whole(node.attrs && record(node.attrs).start, 0, 9999) ?? 1;
          out.push(start === 1 ? { type: "orderedList", content: listItems } : { type: "orderedList", attrs: { start }, content: listItems });
        }
        break;
      }
      case "table": {
        const rows: RichRow[] = items(node.content).map((entry) => {
          const row = record(entry);
          spend(budget, "nodes", 1);
          if (row.type !== "tableRow") throw new Refused("invalid");
          const cells: RichCell[] = items(row.content).map((cellEntry) => {
            const cell = record(cellEntry);
            spend(budget, "nodes", 1);
            spend(budget, "cells", 1);
            if (cell.type !== "tableCell" && cell.type !== "tableHeader") throw new Refused("invalid");
            const attrs = cell.attrs ? record(cell.attrs) : {};
            const colspan = whole(attrs.colspan, 1, MAX_SPAN) ?? 1;
            const rowspan = whole(attrs.rowspan, 1, MAX_SPAN) ?? 1;
            const spans = { ...(colspan > 1 ? { colspan } : {}), ...(rowspan > 1 ? { rowspan } : {}) };
            const content = startsWithParagraph(cleanBlocks(cell.content, budget, depth + 1));
            return Object.keys(spans).length > 0 ? { type: cell.type, attrs: spans, content } : { type: cell.type, content };
          });
          return { type: "tableRow", content: cells };
        });
        const kept = rows.filter((row) => row.content.length > 0);
        if (kept.length > 0) out.push({ type: "table", content: kept });
        break;
      }
      case "image": {
        const attrs = record(node.attrs);
        // Only pictures the teacher uploaded: the server points `src` at the stored file.
        if (!isUuid(attrs.mediaId)) throw new Refused("invalid");
        spend(budget, "images", 1);
        const alt = typeof attrs.alt === "string" ? attrs.alt.replace(CONTROL, "").trim().slice(0, 200) : "";
        const src = typeof attrs.src === "string" ? attrs.src : "";
        // The width the teacher dragged it to, in CSS pixels. The height follows from the picture,
        // so it is never stored (a stored one would stretch it on a narrower screen).
        const width = typeof attrs.width === "number" && Number.isFinite(attrs.width) ? Math.round(attrs.width) : null;
        const align = RICH_IMAGE_ALIGNS.find((value) => value === attrs.align);
        out.push({
          type: "image",
          attrs: {
            src,
            mediaId: attrs.mediaId,
            ...(alt ? { alt } : {}),
            ...(width !== null ? { width: Math.min(Math.max(width, MIN_IMAGE_WIDTH), MAX_IMAGE_WIDTH) } : {}),
            ...(align ? { align } : {}),
          },
        });
        break;
      }
      case "blockMath": {
        const latex = cleanLatex(node.attrs, budget);
        if (latex) out.push({ type: "blockMath", attrs: { latex } });
        break;
      }
      default:
        throw new Refused("invalid");
    }
  }
  return out;
}

/** Whether the blocks hold anything to show: words, maths or a picture. */
function hasContent(blocks: RichBlock[]): boolean {
  return blocks.some((block) => {
    switch (block.type) {
      case "paragraph":
        return (block.content ?? []).some((item) => item.type === "inlineMath" || (item.type === "text" && item.text.trim() !== ""));
      case "bulletList":
      case "orderedList":
        return block.content.some((li) => hasContent(li.content));
      case "table":
        return block.content.some((row) => row.content.some((cell) => hasContent(cell.content)));
      default:
        return true;
    }
  });
}

const isBlankParagraph = (block: RichBlock) => block.type === "paragraph" && !hasContent([block]);

/**
 * A document from an editor, checked: only the known nodes and marks, sensible sizes, at most
 * `maxText` characters of text and maths. Returns a fresh, normalised copy ("" when there's
 * nothing in it). Throws Refused with "invalid" or "tooLong".
 */
function cleanDoc(raw: unknown, mode: RichMode, maxText: number): RichText {
  const doc = record(raw);
  if (doc.type !== "doc") throw new Refused("invalid");
  const budget: Budget = { mode, maxText, nodes: 0, text: 0, images: 0, cells: 0 };
  const blocks = cleanBlocks(doc.content, budget, 0);
  // Blank lines at the very start and end are the editor's, not the teacher's.
  while (blocks.length > 0 && isBlankParagraph(blocks[0])) blocks.shift();
  while (blocks.length > 0 && isBlankParagraph(blocks[blocks.length - 1])) blocks.pop();
  return hasContent(blocks) ? { type: "doc", content: blocks } : "";
}

/** A rich text value from a form field: the editor's JSON, or plain text (older forms, tests, the seed). */
export function richField(
  input: Input,
  name: string,
  max: number,
  errors: FieldErrors,
  { required = false, mode = "block" }: { required?: boolean; mode?: RichMode } = {},
): RichText {
  const raw = input[name] ?? "";
  if (!raw.trimStart().startsWith(RICH_PREFIX)) return plainText(input, name, max, errors, required);
  if (raw.length > MAX_JSON) {
    errors[name] = "tooLong";
    return "";
  }
  try {
    const value = cleanDoc(JSON.parse(raw), mode, max);
    if (required && value === "") errors[name] = "required";
    return value;
  } catch (error) {
    if (error instanceof Refused) errors[name] = error.reason;
    else if (error instanceof SyntaxError) errors[name] = "invalid";
    else throw error;
    return "";
  }
}

/**
 * A website text stored twice, as `{ [plain]: text, [rich]: document }`: the plain text for page
 * descriptions and previews (and older readers), the document to show. Plain text posted as such
 * keeps no document.
 */
export function richColumns<P extends string, R extends string>(value: RichText, plain: P, rich: R) {
  return { [plain]: richPlain(value), [rich]: typeof value === "string" ? null : value } as { [K in P]: string } & { [K in R]: RichDoc | null };
}

/** A field's value as the editor posts it again, e.g. to fill a refused form back in. */
export function richToField(value: RichText | undefined | null): string {
  if (!value) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** A field's posted value read back: the editor's document, or plain text. */
export function richFromField(raw: string | undefined | null): RichText {
  if (!raw) return "";
  if (!raw.trimStart().startsWith(RICH_PREFIX)) return raw;
  try {
    const parsed = JSON.parse(raw) as RichDoc;
    return parsed && parsed.type === "doc" && Array.isArray(parsed.content) ? parsed : "";
  } catch {
    return "";
  }
}

/** How plain text is read: as an inline or block field, and whether $…$ in it is maths (question text). */
export type TextOptions = { mode?: RichMode; dollars?: boolean };

/**
 * Plain text from before the editors as a document, for the editor to open: blank lines make
 * paragraphs and line breaks stay. In question text $…$ becomes a formula ($$…$$ a formula on its
 * own line, or an ordinary one in an inline field); elsewhere a dollar sign is just a dollar sign.
 */
export function textToDoc(source: string, { mode = "block", dollars = true }: TextOptions = {}): RichDoc {
  const content: RichBlock[] = [];
  for (const paragraph of source.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    let line: RichInline[] = [];
    const flush = () => {
      if (line.length > 0) content.push({ type: "paragraph", content: line });
      line = [];
    };
    for (const segment of dollars ? splitMath(paragraph) : [{ kind: "text" as const, value: paragraph }]) {
      if (segment.kind === "text") {
        segment.value.split("\n").forEach((part, i) => {
          if (i > 0) line.push({ type: "hardBreak" });
          if (part) line.push({ type: "text", text: part });
        });
      } else if (segment.kind === "inline" || mode === "inline") {
        line.push({ type: "inlineMath", attrs: { latex: segment.tex } });
      } else {
        flush();
        content.push({ type: "blockMath", attrs: { latex: segment.tex } });
      }
    }
    flush();
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

/** What an editor opens with: the document, or older plain text made into one. */
export function richToDoc(value: RichText | undefined | null, options: TextOptions = {}): RichDoc {
  if (!value) return { type: "doc", content: [{ type: "paragraph" }] };
  return typeof value === "string" ? textToDoc(value, options) : value;
}

function inlineText(content: RichInline[] = []): string {
  return content.map((item) => (item.type === "text" ? item.text : item.type === "hardBreak" ? "\n" : `$${item.attrs.latex}$`)).join("");
}

function blocksText(blocks: RichBlock[], gap: string): string {
  return blocks
    .map((block): string => {
      switch (block.type) {
        case "paragraph":
          return inlineText(block.content);
        case "bulletList":
          return block.content.map((li) => `• ${blocksText(li.content, "\n")}`).join("\n");
        case "orderedList":
          return block.content.map((li, i) => `${(block.attrs?.start ?? 1) + i}. ${blocksText(li.content, "\n")}`).join("\n");
        case "table":
          return block.content.map((row) => row.content.map((cell) => blocksText(cell.content, " ")).join(" | ")).join("\n");
        case "blockMath":
          return `$$${block.attrs.latex}$$`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(gap);
}

/** Rich text as plain text (maths as $…$), for page descriptions, previews and one-line lists. */
export function richPlain(value: RichText | undefined | null): string {
  if (!value) return "";
  return typeof value === "string" ? value : blocksText(value.content, "\n\n").trim();
}

function eachBlock(blocks: RichBlock[], visit: (block: RichBlock) => void) {
  for (const block of blocks) {
    visit(block);
    if (block.type === "bulletList" || block.type === "orderedList") block.content.forEach((li) => eachBlock(li.content, visit));
    if (block.type === "table") block.content.forEach((row) => row.content.forEach((cell) => eachBlock(cell.content, visit)));
  }
}

/** The media ids of the pictures in rich text. */
export function richImageIds(value: RichText | undefined | null): string[] {
  if (!value || typeof value === "string") return [];
  const ids: string[] = [];
  eachBlock(value.content, (block) => {
    if (block.type === "image") ids.push(block.attrs.mediaId);
  });
  return ids;
}

/** The same rich text with each picture pointed at its stored file (`urls` maps media id to URL). */
export function withImageUrls(value: RichText, urls: Map<string, string>): RichText {
  if (typeof value === "string") return value;
  const fix = (blocks: RichBlock[]): RichBlock[] =>
    blocks.map((block) => {
      switch (block.type) {
        case "image":
          return { ...block, attrs: { ...block.attrs, src: urls.get(block.attrs.mediaId) ?? block.attrs.src } };
        case "bulletList":
        case "orderedList":
          return { ...block, content: block.content.map((li) => ({ ...li, content: fix(li.content) })) };
        case "table":
          return { ...block, content: block.content.map((row) => ({ ...row, content: row.content.map((cell) => ({ ...cell, content: fix(cell.content) })) })) };
        default:
          return block;
      }
    });
  return { type: "doc", content: fix(value.content) };
}
