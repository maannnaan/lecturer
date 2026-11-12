"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import katex from "katex";
import type { Dictionary } from "@/i18n";

type EditorText = Dictionary["editor"];

/** Buttons that write the LaTeX teachers need most, so nobody has to remember it. */
const SNIPPETS: [label: string, tex: string][] = [
  ["a/b", "\\frac{a}{b}"],
  ["x²", "x^{2}"],
  ["x₁", "x_{1}"],
  ["√x", "\\sqrt{x}"],
  ["×", "\\times "],
  ["÷", "\\div "],
  ["±", "\\pm "],
  ["°", "^{\\circ}"],
  ["π", "\\pi "],
  ["θ", "\\theta "],
  ["α", "\\alpha "],
  ["Δ", "\\Delta "],
  ["→", "\\rightarrow "],
  ["≤", "\\le "],
  ["≥", "\\ge "],
];

/**
 * The equation box: LaTeX in, the formula as students will see it underneath, typeset as you
 * type. `editing` adds "remove"; `allowDisplay` offers a formula on its own line.
 */
export function EquationDialog({
  initial,
  allowDisplay,
  onSave,
  onRemove,
  onClose,
  t,
}: {
  initial: { latex: string; display: boolean; editing: boolean };
  allowDisplay: boolean;
  onSave: (latex: string, display: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
  t: EditorText;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [latex, setLatex] = useState(initial.latex);
  const [display, setDisplay] = useState(initial.display);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    input.current?.focus();
  }, []);

  const preview = useMemo(
    () =>
      latex.trim()
        ? katex.renderToString(latex, { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml", trust: false })
        : "",
    [latex, display],
  );

  const close = () => dialog.current?.close();
  const save = () => {
    if (!latex.trim()) return;
    onSave(latex.trim(), allowDisplay && display);
    close();
  };
  const insert = (snippet: string) => {
    const element = input.current;
    const start = element?.selectionStart ?? latex.length;
    const end = element?.selectionEnd ?? latex.length;
    setLatex(latex.slice(0, start) + snippet + latex.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  return (
    <dialog ref={dialog} className="rich-dialog" aria-labelledby={`${id}-title`} onClose={onClose}>
      <h3 id={`${id}-title`} className="panel-title">
        {t.equationTitle}
      </h3>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-latex`}>
          {t.equationLabel}
        </label>
        <textarea
          ref={input}
          id={`${id}-latex`}
          className="input font-mono"
          dir="ltr"
          rows={2}
          spellCheck={false}
          autoComplete="off"
          value={latex}
          onChange={(event) => setLatex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              save();
            }
          }}
          aria-describedby={`${id}-hint`}
        />
        <p className="field-hint" id={`${id}-hint`}>
          {t.equationHint}
        </p>
      </div>
      <div className="rich-snippets" role="group" aria-label={t.equationSymbols}>
        {SNIPPETS.map(([label, tex]) => (
          <button key={tex} type="button" className="rich-tool" title={tex.trim()} aria-label={tex.trim()} onClick={() => insert(tex)}>
            {label}
          </button>
        ))}
      </div>
      <div className="rich-dialog-preview">
        <span className="field-label">{t.equationPreview}</span>
        <div aria-live="polite" className="min-h-10" dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
      {allowDisplay && (
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" checked={display} onChange={(event) => setDisplay(event.target.checked)} />
          {t.equationDisplay}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!latex.trim()}>
          {initial.editing ? t.update : t.insert}
        </button>
        {initial.editing && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              onRemove();
              close();
            }}
          >
            {t.remove}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
          {t.cancel}
        </button>
      </div>
    </dialog>
  );
}
