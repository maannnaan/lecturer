"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PendingButton, SelectField } from "@/components/form";
import { type ImportState, importStudentsAction } from "./actions";

export type ImportText = {
  file: string;
  paste: string;
  columns: string;
  enrollIn: string;
  noCourse: string;
  batch: string;
  noBatch: string;
  check: string;
  run: string;
  seeList: string;
};

const start: ImportState = {};

/**
 * A sheet of students, chosen as a file or pasted, checked before anything is added. The "add"
 * button appears only for the exact text that was last checked and found good.
 */
export function ImportForm({ courses, t }: { courses: { id: string; title: string; batches: { id: string; label: string }[] }[]; t: ImportText }) {
  const [state, action] = useActionState(importStudentsAction, start);
  const [text, setText] = useState("");
  // The course and batch are kept here, so they survive the reset a form gets after each submit
  // (the check comes first, and the choice must still stand when the students are then added).
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const batches = courses.find((course) => course.id === courseId)?.batches ?? [];
  const ready = !state.done && state.checked !== undefined && state.checked === text.replace(/\r\n?/g, "\n");

  return (
    <form action={action} className="card flex flex-col gap-5 p-5">
      <div className="field">
        <label className="field-label" htmlFor="csv-file">
          {t.file}
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv,text/plain"
          className="input !h-auto !py-2.5"
          onChange={async (event) => {
            const picked = event.target.files?.[0];
            if (picked) setText(await picked.text());
          }}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="csv">
          {t.paste}
        </label>
        <textarea id="csv" name="csv" rows={8} className="input font-mono !text-[14px]" value={text} onChange={(event) => setText(event.target.value)} aria-describedby="csv-hint" />
        <p className="field-hint" id="csv-hint">
          {t.columns}
        </p>
      </div>

      {courses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="import-course"
            name="courseId"
            label={t.enrollIn}
            defaultValue={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setBatchId("");
            }}
            options={[{ value: "", label: t.noCourse }, ...courses.map((course) => ({ value: course.id, label: course.title }))]}
          />
          {batches.length > 0 && (
            <SelectField
              key={courseId}
              id="import-batch"
              name="batchId"
              label={t.batch}
              defaultValue={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              options={[{ value: "", label: t.noBatch }, ...batches.map((batch) => ({ value: batch.id, label: batch.label }))]}
            />
          )}
        </div>
      )}

      {state.title && (
        <div className={state.tone === "ok" ? "form-ok" : "form-alert"} role={state.tone === "ok" ? "status" : "alert"}>
          <p>{state.title}</p>
          {state.lines && state.lines.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 font-normal">
              {state.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <PendingButton name="mode" value="check" className={ready ? "btn btn-ghost" : "btn btn-primary"} disabled={!text.trim()}>
          {t.check}
        </PendingButton>
        {ready && (
          <PendingButton name="mode" value="run" className="btn btn-primary">
            {t.run}
          </PendingButton>
        )}
        {state.done && (
          <Link href="/dashboard/students" className="btn btn-ghost">
            {t.seeList}
          </Link>
        )}
      </div>
    </form>
  );
}
