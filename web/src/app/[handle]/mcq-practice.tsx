"use client";

import { type ReactNode, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

type Labels = { yourRight: string; rightAnswer: string; yourAnswer: string; tryAgain: string; explanation: string };

/**
 * Practice on a public MCQ: pick an option and see at once whether it's right, then the
 * explanation. Options arrive already typeset by the server; nothing is saved.
 */
export function McqPractice({
  options,
  keys,
  answer,
  explanation,
  t,
}: {
  options: ReactNode[];
  keys: readonly string[];
  answer: number;
  explanation: ReactNode | null;
  t: Labels;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  return (
    <>
      <div className="options">
        {options.map((option, i) => {
          const state = !done ? "" : i === answer ? " correct" : i === picked ? " wrong" : "";
          return (
            <button
              key={i}
              type="button"
              className={`opt${state}`}
              aria-pressed={picked === i}
              aria-disabled={done}
              onClick={() => !done && setPicked(i)}
            >
              <span className="k">{keys[i]}</span>
              <span className="min-w-0 text-left">{option}</span>
              {done && i === answer && (
                <span className="mark">
                  <Check aria-hidden="true" />
                  {picked === answer ? t.yourRight : t.rightAnswer}
                </span>
              )}
              {done && i === picked && i !== answer && (
                <span className="mark">
                  <X aria-hidden="true" />
                  {t.yourAnswer}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {done && (
        <div role="status">
          {explanation && (
            <div className="explain">
              <b>{t.explanation}</b> {explanation}
            </div>
          )}
          <button type="button" className="sol-btn" onClick={() => setPicked(null)}>
            <RotateCcw aria-hidden="true" />
            {t.tryAgain}
          </button>
        </div>
      )}
    </>
  );
}
