"use client";

import { type ReactNode, useEffect, useState } from "react";
import { QbBookmark } from "./bookmark";
import { useQbNav } from "./nav";
import type { QbCardData, QbListText } from "./types";
import { QbBadge, QbPrivate, QbTag, QbTopic, cx, qbButton } from "./ui";

/*
 * A list of question cards with the QBank design's interactions: answers shown or hidden one by one
 * or all at once, MCQs checked on the first tap (then locked: the right option turns green ✓, a
 * wrong pick red ✗, and the explanation appears). State stays while the page is open.
 */

type Shown = Record<string, boolean>;

/** The keys a card's reveals use: a problem has two (answer and solution). */
function revealKeys(card: QbCardData): string[] {
  if (card.kind === "problem") return [card.answer ? `${card.id}:a` : null, card.solution ? `${card.id}:s` : null].filter((k): k is string => Boolean(k));
  if (card.kind === "cq") return card.parts?.some((p) => p.answer) ? [card.id] : [];
  if (card.kind === "sq") return card.answer ? [card.id] : [];
  return [];
}

export function QbQuestionList({
  cards,
  text,
  summary,
  emptyNote,
  actions,
}: {
  cards: QbCardData[];
  text: QbListText;
  /** The line above the list: "সৃজনশীল প্রশ্ন: মোট ৩২টি, দেখানো হচ্ছে ২০টি". */
  summary: string;
  /** Shown instead of cards when there are none. */
  emptyNote?: ReactNode;
  /** Extra buttons beside the show-all button (the dashboard's "নতুন …"). */
  actions?: ReactNode;
}) {
  const { pending } = useQbNav();
  const [open, setOpen] = useState<Shown>({});
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [said, setSaid] = useState("");

  const mcqs = cards.filter((c) => c.kind === "mcq");
  const keys = cards.flatMap(revealKeys);
  const allMcq = cards.length > 0 && mcqs.length === cards.length;
  const anyPicked = mcqs.some((c) => c.id in picks);
  const allOpen = keys.length > 0 && keys.every((k) => open[k]);
  const canToggle = allMcq ? mcqs.length > 0 : keys.length > 0;
  const hide = allMcq ? anyPicked : allOpen;
  const toggleLabel = allMcq ? (anyPicked ? text.resetAll : text.showAll) : allOpen ? text.hideAll : text.showAll;

  const toggleAll = () => {
    if (allMcq) {
      setPicks(hide ? {} : Object.fromEntries(mcqs.map((c) => [c.id, c.answerIndex ?? 0])));
    } else {
      setOpen((current) => ({ ...current, ...Object.fromEntries(keys.map((k) => [k, !hide])) }));
    }
    setSaid(hide ? text.answersHidden : text.answersShown);
  };

  // Arriving at #q-… (from the board list, or a link): bring that question into view and flash it.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id.startsWith("q-")) return;
    const el = document.getElementById(id);
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    el.classList.remove("qb-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("qb-flash");
  }, [cards]);

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2.5" data-print-hide>
        <p className="m-0 text-qb-muted">{summary}</p>
        <div className="flex flex-wrap gap-2">
          {actions}
          {canToggle && (
            <button type="button" onClick={toggleAll} className={cx(qbButton.outline, "h-11 px-4")}>
              {toggleLabel}
            </button>
          )}
        </div>
      </div>

      {cards.length === 0 && emptyNote}
      {cards.map((card) => (
        <QbCard
          key={card.id}
          card={card}
          text={text}
          open={open}
          onToggle={(key) => setOpen((current) => ({ ...current, [key]: !current[key] }))}
          picked={picks[card.id]}
          onPick={(index) => {
            if (card.id in picks) return;
            setPicks((current) => ({ ...current, [card.id]: index }));
            setSaid(index === card.answerIndex ? text.right : (card.wrongText ?? ""));
          }}
        />
      ))}

      <p role="status" className="sr-only">
        {said}
      </p>
    </section>
  );
}

function QbCard({
  card,
  text,
  open,
  onToggle,
  picked,
  onPick,
}: {
  card: QbCardData;
  text: QbListText;
  open: Shown;
  onToggle: (key: string) => void;
  picked: number | undefined;
  onPick: (index: number) => void;
}) {
  const figure = card.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- uploads live on our own host or Cloudinary
    <img src={card.image} alt="" className="qb-figure" loading="lazy" />
  ) : null;
  const tags = (
    <>
      {card.topic && <QbTopic>{card.topic}</QbTopic>}
      {card.tags.map((tag) => (
        <QbTag key={tag}>{tag}</QbTag>
      ))}
      {card.privateLabel && <QbPrivate>{card.privateLabel}</QbPrivate>}
    </>
  );
  const video = card.video ? (
    <a href={card.video} target="_blank" rel="noopener noreferrer" className={cx(qbButton.outline, "h-11 px-4")}>
      {text.video}
    </a>
  ) : null;
  const tools = card.tools ? (
    <div className="flex flex-wrap items-center gap-2 border-t border-qb-divider bg-qb-surface-alt px-[22px] py-2.5" data-print-hide>
      {card.tools}
    </div>
  ) : null;
  const answerBox = (label: string, body: ReactNode) => (
    <div className="rounded-lg bg-qb-answer px-3.5 py-3 text-[15px] text-qb-answer-ink">
      <b>{label}</b> {body}
    </div>
  );

  const article = "scroll-mt-4 overflow-hidden rounded-2xl border border-qb-line bg-qb-surface focus:outline-none";

  if (card.kind === "cq") {
    const isOpen = !!open[card.id];
    const hasAnswers = card.parts?.some((p) => p.answer);
    return (
      <article id={card.anchor} tabIndex={-1} aria-label={card.badge} className={article}>
        <div className="flex flex-wrap items-center gap-2 border-b border-qb-divider bg-qb-surface-alt px-[22px] py-3.5">
          <QbBadge tab={card.tab}>{card.badge}</QbBadge>
          {tags}
          {card.marks && <span className="ml-auto text-[13px] text-qb-subtle">{card.marks}</span>}
        </div>
        <div className="flex flex-col gap-4 px-[22px] py-5">
          <div className="rounded-[10px] bg-qb-page px-4 py-3.5 text-[16px]">
            {card.stem}
            {figure}
          </div>
          <ol role="list" className="m-0 flex list-none flex-col gap-3 p-0">
            {(card.parts ?? []).map((part) => (
              <li key={part.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-3">
                  <span className="w-[14px] shrink-0 font-bold text-qb-cq">{part.key}.</span>
                  <div className="flex min-w-0 flex-auto flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <div className="min-w-0 flex-[1_1_14rem]">{part.text}</div>
                    <span className="ml-auto shrink-0 text-[13px] whitespace-nowrap text-qb-subtle">{part.meta}</span>
                  </div>
                </div>
                {isOpen && part.answer && (
                  <div className="ml-[26px] rounded-lg bg-qb-answer px-3.5 py-2.5 text-[15px] text-qb-answer-ink">{part.answer}</div>
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2" data-print-hide>
            {hasAnswers && (
              <button type="button" aria-expanded={isOpen} onClick={() => onToggle(card.id)} className={cx(qbButton.accent, "h-11 px-4")}>
                {isOpen ? text.hideAnswer : text.showAnswer}
              </button>
            )}
            <QbBookmark id={card.id} label={text.bookmark} done={text.bookmarked} />
            {video}
          </div>
        </div>
        {tools}
      </article>
    );
  }

  if (card.kind === "mcq") {
    const answered = picked !== undefined;
    return (
      <article id={card.anchor} tabIndex={-1} aria-label={card.badge} className={article}>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div className="flex flex-wrap items-center gap-2">
            <QbBadge tab={card.tab}>{card.badge}</QbBadge>
            {tags}
          </div>
          <div className="text-[17px] font-semibold">
            {card.stem}
            {figure}
          </div>
          {card.statements && card.statements.length > 0 && (
            <>
              <ol role="list" className="m-0 flex list-none flex-col gap-1 p-0 text-[16px]">
                {card.statements.map((s) => (
                  <li key={s.key} className="flex gap-2">
                    <span className="shrink-0 font-semibold">{s.key}.</span>
                    <span className="min-w-0">{s.text}</span>
                  </li>
                ))}
              </ol>
              {card.prompt && <p className="m-0 text-[17px] font-semibold">{card.prompt}</p>}
            </>
          )}
          <div role="group" aria-label={card.badge} className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2.5">
            {(card.options ?? []).map((option, j) => {
              const correct = answered && j === card.answerIndex;
              const wrong = answered && j === picked && j !== card.answerIndex;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-disabled={answered || undefined}
                  onClick={() => {
                    if (!answered) onPick(j);
                  }}
                  className={cx(
                    "flex min-h-[52px] items-center gap-3 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-left text-[16px] text-qb-ink",
                    correct ? "border-qb-accent bg-qb-accent-soft" : wrong ? "border-qb-wrong bg-qb-wrong-soft" : "border-qb-field bg-qb-surface",
                    answered ? "cursor-default" : "hover:border-qb-faint hover:bg-qb-page",
                  )}
                >
                  <span
                    className={cx(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold",
                      correct ? "bg-qb-accent text-white" : wrong ? "bg-qb-wrong text-white" : "bg-qb-chip text-qb-muted",
                    )}
                  >
                    {option.key}
                  </span>
                  <span className="min-w-0 flex-auto text-left">{option.text}</span>
                  <span aria-hidden="true" className={cx("font-bold", correct ? "text-qb-accent" : "text-qb-wrong")}>
                    {correct ? "✓" : wrong ? "✗" : ""}
                  </span>
                  {correct && <span className="sr-only">{text.correctMark}</span>}
                  {wrong && <span className="sr-only">{text.wrongMark}</span>}
                </button>
              );
            })}
          </div>
          {answered && card.explanation && (
            <div className="text-[15px] text-qb-muted">
              <strong className="text-qb-ink">{text.explanation}</strong> {card.explanation}
            </div>
          )}
          {video && <div data-print-hide>{video}</div>}
        </div>
        {tools}
      </article>
    );
  }

  if (card.kind === "sq") {
    const isOpen = !!open[card.id];
    return (
      <article id={card.anchor} tabIndex={-1} aria-label={card.badge} className={article}>
        <div className="flex flex-col gap-2.5 px-[22px] py-[18px]">
          <div className="flex flex-wrap items-center gap-3">
            <QbBadge tab={card.tab}>{card.badge}</QbBadge>
            {tags}
            {card.answer && (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => onToggle(card.id)}
                className="ml-auto h-10 rounded-lg border border-qb-field bg-qb-surface px-3.5 text-[14px] font-semibold text-qb-ink hover:bg-qb-page"
                data-print-hide
              >
                {isOpen ? text.hideAnswer : text.showAnswer}
              </button>
            )}
          </div>
          <div className="text-[17px] font-semibold">
            {card.stem}
            {figure}
          </div>
          {isOpen && card.answer && (
            <div className="rounded-lg bg-qb-answer px-3.5 py-3 text-[15px] text-qb-answer-ink">{card.answer}</div>
          )}
          {video && <div data-print-hide>{video}</div>}
        </div>
        {tools}
      </article>
    );
  }

  // A numerical problem: its result and its worked solution, each behind its own button.
  const answerOpen = !!open[`${card.id}:a`];
  const solutionOpen = !!open[`${card.id}:s`];
  return (
    <article id={card.anchor} tabIndex={-1} aria-label={card.badge} className={article}>
      <div className="flex flex-col gap-3.5 px-[22px] py-5">
        <div className="flex flex-wrap items-center gap-2">
          <QbBadge tab={card.tab}>{card.badge}</QbBadge>
          {tags}
        </div>
        <div className="text-[17px]">
          {card.stem}
          {figure}
        </div>
        {answerOpen && card.answer && answerBox(text.answer, card.answer)}
        {solutionOpen && card.solution && answerBox(text.solution, card.solution)}
        <div className="flex flex-wrap gap-2" data-print-hide>
          {card.answer && (
            <button type="button" aria-expanded={answerOpen} onClick={() => onToggle(`${card.id}:a`)} className={cx(qbButton.accent, "h-11 px-4")}>
              {answerOpen ? text.hideAnswer : text.showAnswer}
            </button>
          )}
          {card.solution && (
            <button type="button" aria-expanded={solutionOpen} onClick={() => onToggle(`${card.id}:s`)} className={cx(qbButton.outline, "h-11 px-4")}>
              {solutionOpen ? text.hideSolution : text.showSolution}
            </button>
          )}
          <QbBookmark id={card.id} label={text.bookmark} done={text.bookmarked} />
          {video}
        </div>
      </div>
      {tools}
    </article>
  );
}
