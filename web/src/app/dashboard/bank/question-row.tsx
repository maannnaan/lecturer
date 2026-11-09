import Link from "next/link";
import { ChevronDown, ChevronUp, Copy, Landmark, Pencil } from "lucide-react";
import { MathText } from "@/components/math-text";
import type { Dictionary, Locale } from "@/i18n";
import { boardLabel } from "@/lib/board-label";
import type { Question } from "@/server/questions";
import { duplicateQuestionAction, moveQuestionAction } from "./actions";

/**
 * One question in a bank list: its type, board and visibility, the stem typeset, and actions.
 * `place` names its course and chapter where the list mixes them; `move` adds up/down buttons.
 */
export function QuestionRow({
  question,
  d,
  locale,
  place,
  move,
}: {
  question: Question;
  d: Dictionary;
  locale: Locale;
  place?: string;
  move?: { first: boolean; last: boolean };
}) {
  const t = d.dashboard.bank;
  return (
    <li className="card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag">{d.questions.types[question.type]}</span>
        {question.board && (
          <span className="tag board">
            <Landmark aria-hidden="true" />
            {boardLabel(question, d, locale)}
          </span>
        )}
        {question.visibility === "private" && <span className="badge">{t.privateBadge}</span>}
        {place && <span className="min-w-0 text-[13.5px] text-muted">{place}</span>}
      </div>
      <Link href={`/dashboard/bank/${question.id}`} className="bank-stem text-ink">
        <MathText text={question.body.stem} />
      </Link>
      <div className="row-actions">
        {move &&
          (["up", "down"] as const).map((dir) => (
            <form key={dir} action={moveQuestionAction}>
              <input type="hidden" name="questionId" value={question.id} />
              <input type="hidden" name="direction" value={dir} />
              <button
                type="submit"
                className="icon-btn"
                disabled={dir === "up" ? move.first : move.last}
                aria-label={dir === "up" ? d.common.moveUp : d.common.moveDown}
              >
                {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>
            </form>
          ))}
        <Link href={`/dashboard/bank/${question.id}`} className="btn btn-ghost btn-xs">
          <Pencil aria-hidden="true" />
          {d.common.edit}
        </Link>
        <form action={duplicateQuestionAction}>
          <input type="hidden" name="questionId" value={question.id} />
          <button type="submit" className="btn btn-ghost btn-xs">
            <Copy aria-hidden="true" />
            {t.duplicate}
          </button>
        </form>
      </div>
    </li>
  );
}
