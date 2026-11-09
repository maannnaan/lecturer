import { type Dictionary, type Locale, formatYear } from "@/i18n";

/** "ঢাকা বোর্ড ২০২৩": the board's name and, if known, the year, as one piece of text. */
export function boardLabel(question: { board: string; year: number | null }, d: Dictionary, locale: Locale): string {
  const name = d.questions.boards[question.board as keyof Dictionary["questions"]["boards"]] ?? question.board;
  return question.year ? `${name} ${formatYear(question.year, locale)}` : name;
}
