"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/form";
import { shrinkImage } from "@/lib/shrink-image";
import { removePhotoAction, setPhotoAction } from "./actions";

type Labels = {
  title: string;
  lead: string;
  choose: string;
  change: string;
  remove: string;
  uploading: string;
  failed: string;
  none: string;
  uploadType: string;
  uploadSize: string;
  uploadOff: string;
};

export function PhotoUploader({ photoUrl, initial, t }: { photoUrl: string | null; initial: string; t: Labels }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", await shrinkImage(file), "photo");
      const res = await fetch("/api/media", { method: "POST", body });
      const answer = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !answer.id) {
        setError({ type: t.uploadType, size: t.uploadSize, unavailable: t.uploadOff }[answer.error ?? ""] ?? t.failed);
        return;
      }
      const set = await setPhotoAction(answer.id);
      if (!set.ok) setError(t.failed);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="photo-title">
      <div>
        <h3 id="photo-title" className="panel-title">
          {t.title}
        </h3>
        <p className="panel-lead">{t.lead}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-2">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload
            <img src={photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="font-head text-4xl text-primary-text" aria-hidden="true">
              {initial}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            id="photo-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) startTransition(() => upload(file));
            }}
          />
          <label htmlFor="photo-file" className="btn btn-primary btn-sm cursor-pointer" aria-disabled={busy}>
            <ImagePlus aria-hidden="true" />
            {busy ? t.uploading : photoUrl ? t.change : t.choose}
          </label>
          {photoUrl && !busy && (
            <form action={removePhotoAction}>
              <PendingButton className="btn btn-danger btn-xs">
                <Trash2 aria-hidden="true" />
                {t.remove}
              </PendingButton>
            </form>
          )}
        </div>
      </div>
      {!photoUrl && !error && <p className="text-sm text-muted">{t.none}</p>}
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
