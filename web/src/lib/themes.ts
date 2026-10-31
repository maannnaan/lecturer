/**
 * The three looks from the Phase 0 design review (design/phase0). Each teacher picks one; it
 * styles their website, their students' pages and their dashboard. Platform pages use `ink`.
 * The tokens themselves live in src/app/globals.css under [data-style="…"].
 */
export const THEMES = ["ink", "mist", "sage"] as const;
export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = "ink";

export function isTheme(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Background, main colour and accent of each theme, for the theme picker's swatches. */
export const THEME_SWATCHES: Record<ThemeName, readonly [string, string, string]> = {
  ink: ["#F7F3EA", "#1C5D5B", "#B0822F"],
  mist: ["#F3F6F9", "#2B5C8A", "#3E9C9E"],
  sage: ["#F6F4EE", "#3F6E55", "#D49A4E"],
};
