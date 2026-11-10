import { cardTags, OPTION_KEYS, totalMarks } from "@/lib/questions";
import type { Question } from "@/lib/types";

export interface PrintGroup {
  heading: string;
  questions: Question[];
}

/** What "Download chapter PDF" and "Download board set" print (or save as PDF): the questions
 *  that match the filters, with their answers. Hidden on screen. */
export function PrintSheet({
  title,
  subtitle,
  groups,
  numbers,
}: {
  title: string;
  subtitle: string;
  groups: PrintGroup[];
  numbers: Map<string, number>;
}) {
  const filled = groups.filter((g) => g.questions.length > 0);
  return (
    <div data-print-sheet className="hidden text-[12.5px] leading-[1.5] text-ink print:block">
      <header className="mb-4 border-b-2 border-ink pb-2">
        <p className="m-0 text-[11px] font-semibold tracking-[0.08em] uppercase">QBank</p>
        <h1 className="m-0 font-display text-[22px] font-bold">{title}</h1>
        <p className="m-0 text-[12px] text-muted">{subtitle}</p>
      </header>
      {filled.length === 0 && <p>No questions match the current filters.</p>}
      {filled.map((group) => (
        <section key={group.heading} className="mb-5">
          <h2 className="m-0 mb-2 text-[13px] font-bold tracking-[0.06em] uppercase">{group.heading}</h2>
          <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
            {group.questions.map((q) => {
              const no = numbers.get(q.id) ?? 0;
              const tags = cardTags(q);
              return (
                <li key={q.id} className="break-inside-avoid">
                  <p className="m-0 font-bold">
                    {q.type} {no}
                    {tags.length > 0 && <span className="font-normal"> · {tags.join(", ")}</span>}
                    {q.type === "CQ" && <span className="font-normal"> · {totalMarks(q)} marks</span>}
                    {q.type === "SQ" && q.level && <span className="font-normal"> · {q.level}</span>}
                  </p>
                  {q.type === "CQ" && (
                    <>
                      <p className="m-0 mt-1 border-l-2 border-field pl-2 whitespace-pre-line">{q.stem}</p>
                      {(q.parts ?? []).map((part) => (
                        <div key={part.key} className="mt-1">
                          <p className="m-0">
                            {part.key}. {part.text}{" "}
                            <span className="text-subtle">
                              ({part.level} · {part.marks})
                            </span>
                          </p>
                          <p className="m-0 pl-4 text-muted">Answer: {part.answer}</p>
                        </div>
                      ))}
                    </>
                  )}
                  {q.type === "MCQ" && (
                    <>
                      <p className="m-0 mt-1 whitespace-pre-line">{q.text}</p>
                      <p className="m-0 mt-1 grid grid-cols-2 gap-x-4">
                        {(q.options ?? []).map((option, j) => (
                          <span key={j}>
                            {OPTION_KEYS[j]}. {option}
                          </span>
                        ))}
                      </p>
                      <p className="m-0 mt-1 text-muted">
                        Answer: {OPTION_KEYS[q.correctIndex ?? 0]}
                        {q.explanation ? ` — ${q.explanation}` : ""}
                      </p>
                    </>
                  )}
                  {q.type === "SQ" && (
                    <>
                      <p className="m-0 mt-1">{q.text}</p>
                      <p className="m-0 mt-1 text-muted">Answer: {q.answer}</p>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
