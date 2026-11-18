"use client";

import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { saveAnswerAction, submitExamAction } from "../student-actions";

export type TakerQuestion = {
  id: string;
  /** The question's text, drawn on the server. */
  stem: ReactNode;
  statements: { key: string; text: ReactNode }[];
  prompt: string;
  /** The options in this student's order: `index` is the option's place in the question as written. */
  options: { index: number; key: string; text: ReactNode }[];
};

export type TakerText = {
  timeLeft: string;
  answered: string[];
  saving: string;
  saved: string;
  saveFailed: string;
  clear: string;
  submit: string;
  confirmSubmit: string;
  numbers: string[];
};

/** "১২:০৫" from seconds, in the page's digits. */
function clock(seconds: number, digits: string[]): string {
  const s = Math.max(0, seconds);
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return text.replace(/\d/g, (digit) => digits[Number(digit)]);
}

/**
 * A student sitting an exam: the questions, each pick saved at once on the server, a clock that
 * counts down to the deadline the server set (corrected for the gap between this device's clock
 * and the server's), and handing in, by the student or by the clock at zero. Picks are only ever
 * sent as an option's index; the score is the server's to work out.
 */
export function ExamTaker({
  handle,
  number,
  attemptId,
  deadline,
  serverNow,
  questions,
  initial,
  t,
}: {
  handle: string;
  number: number;
  attemptId: string;
  /** The deadline and the server's time when the page was made, both in milliseconds. */
  deadline: number;
  serverNow: number;
  questions: TakerQuestion[];
  /** The answers already saved: exam question id → option index. */
  initial: Record<string, number>;
  t: TakerText;
}) {
  const [answers, setAnswers] = useState(initial);
  const [status, setStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const [, startSaving] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  // How far this device's clock is from the server's, measured once as the page arrived.
  const [skew] = useState(() => serverNow - Date.now());
  const [left, setLeft] = useState(() => Math.ceil((deadline - serverNow) / 1000));
  const submitForm = useRef<HTMLFormElement>(null);
  const handedIn = useRef(false);

  useEffect(() => {
    const tick = () => {
      const seconds = Math.ceil((deadline - (Date.now() + skew)) / 1000);
      setLeft(seconds);
      // Time is up: hand in what is saved (the server would count it at the deadline anyway).
      if (seconds <= 0 && !handedIn.current) {
        handedIn.current = true;
        submitForm.current?.requestSubmit();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, skew]);

  const pick = (questionId: string, choice: number | null) => {
    const before = answers[questionId];
    setAnswers((current) => {
      const next = { ...current };
      if (choice === null) delete next[questionId];
      else next[questionId] = choice;
      return next;
    });
    setPending(questionId);
    startSaving(async () => {
      const ok = await saveAnswerAction(handle, attemptId, questionId, choice).catch(() => false);
      setPending((current) => (current === questionId ? null : current));
      setStatus({ id: questionId, ok });
      // Not saved: show the pick as it stands on the server.
      if (!ok)
        setAnswers((current) => {
          const next = { ...current };
          if (before === undefined) delete next[questionId];
          else next[questionId] = before;
          return next;
        });
    });
  };

  const done = Object.keys(answers).length;
  const urgent = left <= 60;

  return (
    <div className="flex flex-col gap-5">
      <div className={`exam-bar ${urgent ? "exam-bar-urgent" : ""}`} role="timer" aria-live={urgent ? "assertive" : "off"} aria-label={t.timeLeft}>
        <span className="text-[14px] font-semibold">{t.timeLeft}</span>
        <b className="font-num text-[24px] tabular-nums">{clock(left, t.numbers)}</b>
        <span className="ml-auto text-[14px]">{t.answered[done] ?? ""}</span>
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <li key={q.id} className="card p-5" id={`q-${q.id}`}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[14px] font-bold text-primary-text">{t.numbers[i + 1] ?? i + 1}</span>
              <div className="min-w-0 flex-1 text-[16.5px] leading-[1.8] text-ink">{q.stem}</div>
            </div>
            {q.statements.length > 0 && (
              <ol className="stmts ml-11">
                {q.statements.map((s) => (
                  <li key={s.key}>
                    <span>{s.key}.</span>
                    {s.text}
                  </li>
                ))}
              </ol>
            )}
            {q.prompt && <p className="ml-11 text-[16px] text-ink">{q.prompt}</p>}
            <div className="options" role="radiogroup" aria-label={t.numbers[i + 1] ?? String(i + 1)}>
              {q.options.map((option) => {
                const chosen = answers[q.id] === option.index;
                return (
                  <button
                    key={option.index}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    className={`opt ${chosen ? "opt-chosen" : ""}`}
                    onClick={() => pick(q.id, option.index)}
                    disabled={left <= 0}
                  >
                    <span className="k">{option.key}</span>
                    <span className="min-w-0">{option.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex min-h-6 flex-wrap items-center gap-3 text-[13.5px]">
              {pending === q.id ? (
                <span className="text-muted">{t.saving}</span>
              ) : status?.id === q.id ? (
                <span className={status.ok ? "text-ok" : "font-semibold text-bad"} role={status.ok ? undefined : "alert"}>
                  {status.ok ? t.saved : t.saveFailed}
                </span>
              ) : null}
              {answers[q.id] !== undefined && left > 0 && (
                <button type="button" className="link !text-[13.5px]" onClick={() => pick(q.id, null)}>
                  {t.clear}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <form
        ref={submitForm}
        action={submitExamAction}
        onSubmit={(event) => {
          // Asked only when the student hands in early; the clock hands in without asking.
          if (left > 0 && !window.confirm(t.confirmSubmit)) event.preventDefault();
        }}
      >
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="number" value={number} />
        <input type="hidden" name="attemptId" value={attemptId} />
        <button type="submit" className="btn btn-primary btn-block">
          {t.submit}
        </button>
      </form>
    </div>
  );
}
