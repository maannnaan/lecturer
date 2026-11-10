"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { Question, QuestionPlace } from "@/lib/types";
import { CqCard, McqCard, SqCard } from "./cards";
import type { useAnswers } from "./use-answers";

/** Numbers each question within its type, in list order: CQ 1, CQ 2, MCQ 1 … */
export function numberByType(questions: Question[]): Map<string, number> {
  const seen: Record<string, number> = {};
  const numbers = new Map<string, number>();
  for (const q of questions) {
    seen[q.type] = (seen[q.type] ?? 0) + 1;
    numbers.set(q.id, seen[q.type]);
  }
  return numbers;
}

/** A list of question cards of any type. With `places`, each card says which chapter it is from. */
export function QuestionCards({
  list,
  numbers,
  answers,
  places,
}: {
  list: Question[];
  numbers: Map<string, number>;
  answers: ReturnType<typeof useAnswers>;
  places?: Record<string, QuestionPlace>;
}) {
  return (
    <>
      {list.map((q) => {
        const no = numbers.get(q.id) ?? 0;
        const card =
          q.type === "CQ" ? (
            <CqCard q={q} no={no} open={!!answers.open[q.id]} onToggle={() => answers.toggle(q.id)} />
          ) : q.type === "MCQ" ? (
            <McqCard q={q} no={no} picked={answers.picks[q.id]} onPick={(i) => answers.pick(q, i, `MCQ ${no}`)} />
          ) : (
            <SqCard q={q} no={no} open={!!answers.open[q.id]} onToggle={() => answers.toggle(q.id)} />
          );
        const place = places?.[q.id];
        if (!place) return <Fragment key={q.id}>{card}</Fragment>;
        return (
          <div key={q.id} className="flex flex-col gap-2">
            <Link href={place.href} className="self-start text-[14px] font-semibold">
              {place.label} →
            </Link>
            {card}
          </div>
        );
      })}
    </>
  );
}
