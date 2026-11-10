"use client";

import { BoardTag, button, TypeBadge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { cardTags, domId, OPTION_KEYS, totalMarks } from "@/lib/questions";
import type { Question } from "@/lib/types";
import { BookmarkButton } from "./bookmark-button";

/* The three question cards from Chapter.dc.html. They only draw; the list that holds them
   keeps which answers are open and which options were picked (see use-answers.ts). */

const article = "scroll-mt-4 rounded-2xl border border-line bg-surface focus:outline-none";

/** CQ: the stem, parts a–d with their level and marks, and the model answers on request. */
export function CqCard({ q, no, open, onToggle }: { q: Question; no: number; open: boolean; onToggle: () => void }) {
  return (
    <article id={domId(q)} tabIndex={-1} aria-label={`CQ ${no}`} className={cx(article, "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-surface-alt px-[22px] py-3.5">
        <TypeBadge type="CQ">CQ {no}</TypeBadge>
        {cardTags(q).map((tag) => (
          <BoardTag key={tag}>{tag}</BoardTag>
        ))}
        <span className="ml-auto text-[13px] text-subtle">{totalMarks(q)} marks</span>
      </div>
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <p className="m-0 rounded-[10px] bg-page px-4 py-3.5 text-[16px] whitespace-pre-line">{q.stem}</p>
        <ol role="list" className="m-0 flex list-none flex-col gap-3 p-0">
          {(q.parts ?? []).map((part) => (
            <li key={part.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-3">
                <span className="shrink-0 font-bold text-cq">{part.key}.</span>
                <div className="flex min-w-0 flex-auto flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="min-w-0 flex-[1_1_14rem]">{part.text}</span>
                  <span className="ml-auto shrink-0 text-[13px] whitespace-nowrap text-subtle">
                    {part.level} · {part.marks}
                  </span>
                </div>
              </div>
              {open && (
                <div className="ml-[26px] rounded-lg bg-answer px-3.5 py-2.5 text-[15px] text-answer-ink">
                  {part.answer}
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-expanded={open} onClick={onToggle} className={cx(button.accent, "h-11 px-4")}>
            {open ? "Hide answers" : "Show answers"}
          </button>
          <BookmarkButton id={q.id} />
        </div>
      </div>
    </article>
  );
}

/** MCQ: tap an option to check it. The question then locks, the right option turns green with ✓,
 *  a wrong pick turns red with ✗, and the explanation appears. */
export function McqCard({
  q,
  no,
  picked,
  onPick,
}: {
  q: Question;
  no: number;
  picked: number | undefined;
  onPick: (index: number) => void;
}) {
  const answered = picked !== undefined;
  return (
    <article id={domId(q)} tabIndex={-1} aria-label={`MCQ ${no}`} className={cx(article, "flex flex-col gap-3.5 px-[22px] py-5")}>
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type="MCQ">MCQ {no}</TypeBadge>
        {cardTags(q).map((tag) => (
          <BoardTag key={tag}>{tag}</BoardTag>
        ))}
      </div>
      <p className="m-0 text-[17px] font-semibold whitespace-pre-line">{q.text}</p>
      <div role="group" aria-label="Options" className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2.5">
        {(q.options ?? []).map((option, j) => {
          const correct = answered && j === q.correctIndex;
          const wrong = answered && j === picked && j !== q.correctIndex;
          return (
            <button
              key={j}
              type="button"
              aria-disabled={answered || undefined}
              onClick={() => {
                if (!answered) onPick(j);
              }}
              className={cx(
                "flex min-h-[52px] items-center gap-3 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-left text-[16px] text-ink",
                correct ? "border-accent bg-accent-soft" : wrong ? "border-wrong bg-wrong-soft" : "border-field bg-surface",
                answered ? "cursor-default" : "hover:border-faint hover:bg-page",
              )}
            >
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                  correct ? "bg-accent text-white" : wrong ? "bg-wrong text-white" : "bg-chip text-muted",
                )}
              >
                {OPTION_KEYS[j]}
              </span>
              <span className="flex-auto text-left">{option}</span>
              <span aria-hidden="true" className={cx("font-bold", correct ? "text-accent" : "text-wrong")}>
                {correct ? "✓" : wrong ? "✗" : ""}
              </span>
              {correct && <span className="sr-only">(correct answer)</span>}
              {wrong && <span className="sr-only">(your answer, wrong)</span>}
            </button>
          );
        })}
      </div>
      {answered && q.explanation && (
        <p className="m-0 text-[15px] text-muted">
          <strong className="text-ink">Explanation:</strong> {q.explanation}
        </p>
      )}
    </article>
  );
}

/** SQ: the question and a show/hide answer button. */
export function SqCard({ q, no, open, onToggle }: { q: Question; no: number; open: boolean; onToggle: () => void }) {
  return (
    <article id={domId(q)} tabIndex={-1} aria-label={`SQ ${no}`} className={cx(article, "flex flex-col gap-2.5 px-[22px] py-[18px]")}>
      <div className="flex flex-wrap items-center gap-3">
        <TypeBadge type="SQ">SQ {no}</TypeBadge>
        {q.level && <span className="text-[13px] text-subtle">{q.level}</span>}
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="ml-auto h-10 rounded-lg border border-field bg-surface px-3.5 text-[14px] font-semibold text-ink hover:bg-page"
        >
          {open ? "Hide answer" : "Show answer"}
        </button>
      </div>
      <p className="m-0 text-[17px] font-semibold">{q.text}</p>
      {open && <p className="m-0 rounded-lg bg-answer px-3.5 py-3 text-[15px] text-answer-ink">{q.answer}</p>}
    </article>
  );
}
