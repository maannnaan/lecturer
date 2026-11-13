import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Text must stay readable in every look: the platform's own ("app") and the three website themes.
// This reads their colour tokens straight from globals.css and checks each text colour against
// the surfaces it is written on (WCAG 2: 4.5:1 for normal text).

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** The `--lb-*` tokens of one `[data-style="…"]` block that are plain hex colours. */
function tokens(style: string): Record<string, string> {
  const block = new RegExp(`\\[data-style="${style}"\\] \\{([^}]*)\\}`).exec(css)?.[1];
  if (!block) throw new Error(`No [data-style="${style}"] block in globals.css`);
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--lb-([a-z0-9-]+):\s*([^;]+);/g)) {
    if (/^#[0-9a-f]{6}$/i.test(value.trim())) out[name] = value.trim();
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text token → the surface tokens it is written on. */
const PAIRS: [string, string[]][] = [
  ["ink", ["bg", "bg-2", "surface", "surface-2"]],
  ["ink-2", ["bg", "bg-2", "surface", "surface-2"]],
  ["muted", ["bg", "surface", "surface-2"]],
  ["primary-text", ["bg", "surface", "primary-soft"]],
  ["on-primary", ["primary"]],
  ["accent-ink", ["bg", "surface", "accent-soft"]],
  ["ok", ["ok-soft"]],
  ["bad", ["bad-soft", "surface"]],
  ["side-ink-2", ["side-bg"]],
  ["side-ink-3", ["side-bg"]],
  ["date-ink", ["date-bg"]],
];

describe.each(["app", "ink", "mist", "sage"])("the %s look", (style) => {
  const t = tokens(style);

  it("has the colours every component reads", () => {
    for (const name of ["bg", "surface", "ink", "ink-2", "muted", "line", "primary", "on-primary", "primary-soft", "primary-text", "bad", "bad-soft"]) {
      expect(t[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(PAIRS)("writes %s readably", (text, surfaces) => {
    for (const surface of surfaces) {
      // A token that isn't a plain colour here (a gradient, a translucent white) is skipped.
      if (!t[text] || !t[surface]) continue;
      expect(contrast(t[text], t[surface]), `${text} on ${surface}: ${t[text]} on ${t[surface]}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
