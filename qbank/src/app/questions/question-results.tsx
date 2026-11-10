"use client";

import { useMemo } from "react";
import { numberByType, QuestionCards } from "@/components/questions/question-cards";
import { toggleAllState, useAnswers } from "@/components/questions/use-answers";
import { button } from "@/components/ui";
import { cx } from "@/lib/cx";
import { plural } from "@/lib/format";
import type { Question, QuestionPlace } from "@/lib/types";

export interface ResultGroup {
  heading?: string;
  items: Array<{ question: Question; place: QuestionPlace }>;
}

/** Question cards from many chapters, each saying where it's from, with one show/hide-all button. */
export function QuestionResults({ groups, summary }: { groups: ResultGroup[]; summary: string }) {
  const answers = useAnswers();
  const all = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.question)), [groups]);
  const numbers = useMemo(() => numberByType(all), [all]);
  const places = useMemo(
    () => Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.question.id, i.place]))),
    [groups],
  );
  const toggle = toggleAllState(all, answers.isShown);

  return (
    <div className="flex max-w-[880px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="m-0 text-muted">{summary}</p>
        {all.length > 0 && (
          <button type="button" onClick={() => answers.toggleAll(all)} className={cx(button.outline, "h-11 px-4")}>
            {toggle.label}
          </button>
        )}
      </div>
      {groups.map((group) => (
        <section key={group.heading ?? "all"} aria-label={group.heading} className="flex flex-col gap-4">
          {group.heading && (
            <h2 className="m-0 mt-2 text-[20px] font-bold">
              {group.heading} <span className="text-[15px] font-normal text-subtle">· {plural(group.items.length, "question")}</span>
            </h2>
          )}
          <QuestionCards
            list={group.items.map((i) => i.question)}
            numbers={numbers}
            answers={answers}
            places={places}
          />
        </section>
      ))}
      <p role="status" className="sr-only">
        {answers.announcement}
      </p>
    </div>
  );
}
