import type { ReactNode } from "react";
import type { BankTab } from "@/lib/questions";

/** How a question's card is drawn: a creative question, an MCQ, a short question, or a numerical problem. */
export type QbKind = "cq" | "mcq" | "sq" | "problem";

/**
 * One question, ready to draw: text already typeset on the server (MathText), labels already in
 * the page's language. Client components only add the clicks.
 */
export type QbCardData = {
  id: string;
  /** The element id a link can jump to: "q-<id>". */
  anchor: string;
  kind: QbKind;
  /** The tab it belongs to, for the badge's colours. */
  tab: BankTab;
  /** "CQ ১", "পাঠ্যবই ২" */
  badge: string;
  /** Yellow tags: its board and year, or the test it comes from. */
  tags: string[];
  /** A creative question's total marks, written out: "১০ নম্বর". */
  marks?: string;
  stem: ReactNode;
  image?: string | null;
  /** An MCQ with statements (i, ii, iii) and its last line. */
  statements?: { key: string; text: ReactNode }[];
  prompt?: string;
  options?: { key: string; text: ReactNode }[];
  answerIndex?: number;
  /** What a screen reader hears after a wrong pick: "ভুল। সঠিক উত্তর খ।" */
  wrongText?: string;
  explanation?: ReactNode;
  /** A creative question's parts ক–ঘ; `meta` is "জ্ঞান · ১". */
  parts?: { key: string; text: ReactNode; meta: string; answer: ReactNode | null }[];
  /** A short question's model answer, or a problem's final answer. */
  answer?: ReactNode | null;
  /** A problem's worked solution. */
  solution?: ReactNode | null;
  video?: string;
  /** Teacher only: a private question, and the edit/copy/move buttons. */
  privateLabel?: string;
  tools?: ReactNode;
};

/** The words on a question list's buttons, in the page's language and voice (দেখো / দেখুন). */
export type QbListText = {
  showAnswer: string;
  hideAnswer: string;
  showSolution: string;
  hideSolution: string;
  showAll: string;
  hideAll: string;
  resetAll: string;
  bookmark: string;
  bookmarked: string;
  explanation: string;
  answer: string;
  solution: string;
  video: string;
  right: string;
  answersShown: string;
  answersHidden: string;
  correctMark: string;
  wrongMark: string;
};
