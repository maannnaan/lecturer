import type { ReactNode } from "react";
import { ChevronDown, Landmark, PlayCircle } from "lucide-react";
import { MathText } from "@/components/math-text";
import { type Dictionary, type Locale, formatNumber } from "@/i18n";
import { boardLabel } from "@/lib/board-label";
import { isMcq } from "@/lib/questions";
import type { Question } from "@/server/questions";
import { McqPractice } from "./mcq-practice";

/** One question as students see it on a chapter page; `number` is its place in the list. */
export function QuestionCard({ question, number, d, locale }: { question: Question; number: number; d: Dictionary; locale: Locale }) {
  const q = d.questions;
  const c = d.site.chapter;
  const body = question.body;
  const figure = body.image && (
    // eslint-disable-next-line @next/next/no-img-element -- uploads live on our own host or Cloudinary
    <img src={body.image.url} alt="" className="q-figure" loading="lazy" />
  );

  return (
    <article className="q-card">
      <div className="q-top">
        <span className="q-no">{formatNumber(number, locale)}.</span>
        {question.board && (
          <span className="tag board">
            <Landmark aria-hidden="true" />
            {boardLabel(question, d, locale)}
          </span>
        )}
        {!question.board && question.source && <span className="tag">{question.source}</span>}
        <span className="tag">{q.types[question.type]}</span>
      </div>

      {question.type === "creative" ? (
        <div className={figure ? "stem" : "stem stem-plain"}>
          <p className="q-text">
            <span className="stem-label">{q.stemLabel}</span>
            <MathText text={body.stem} />
          </p>
          {figure}
        </div>
      ) : (
        <>
          <p className="q-text">
            <MathText text={body.stem} />
          </p>
          {figure}
        </>
      )}

      {question.type === "mcq_multi" && (
        <>
          <ol className="stmts">
            {(body.statements ?? []).map((statement, i) => (
              <li key={i}>
                <span>{q.statementKeys[i]}.</span>
                <MathText text={statement} />
              </li>
            ))}
          </ol>
          <p className="q-text">{body.prompt || q.defaultPrompt}</p>
        </>
      )}

      {isMcq(question.type) && (
        <McqPractice
          options={(body.options ?? []).map((option, i) => (
            <MathText key={i} text={option} />
          ))}
          keys={q.optionKeys}
          answer={body.answer ?? 0}
          explanation={body.explanation ? <MathText text={body.explanation} /> : null}
          t={{ yourRight: c.yourRight, rightAnswer: c.rightAnswer, yourAnswer: c.yourAnswer, tryAgain: c.tryAgain, explanation: q.explanation }}
        />
      )}

      {question.type === "short" && body.modelAnswer && (
        <Reveal label={c.showAnswer}>
          <b>{q.answer}</b> <MathText text={body.modelAnswer} />
        </Reveal>
      )}

      {question.type === "creative" && (
        <div className="parts">
          {(body.parts ?? []).map((part, i) => (
            <div key={i} className="part">
              <span className="pk">{q.partKeys[i]}.</span>
              <span className="min-w-0">
                <MathText text={part.text} />
                {part.solution && (
                  <Reveal label={c.showSolution}>
                    <b>{q.solution}</b> <MathText text={part.solution} />
                  </Reveal>
                )}
              </span>
              <span className="marks">{formatNumber(part.marks, locale)}</span>
            </div>
          ))}
        </div>
      )}

      {question.type === "problem" && body.solution && (
        <Reveal label={c.showSolution}>
          <b>{q.solution}</b> <MathText text={body.solution} />
        </Reveal>
      )}

      {question.videoUrl && (
        <p className="q-foot">
          <a href={question.videoUrl} target="_blank" rel="noopener noreferrer" className="link">
            <PlayCircle aria-hidden="true" />
            {q.video}
          </a>
        </p>
      )}
    </article>
  );
}

/** An answer or solution behind a "show" toggle, so students try first. */
function Reveal({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="q-reveal">
      <summary className="sol-btn">
        <ChevronDown aria-hidden="true" />
        {label}
      </summary>
      <div className="explain">{children}</div>
    </details>
  );
}
