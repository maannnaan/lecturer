"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
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

const LONGEST_SIDE = 1200;

/** Shrinks a photo in the browser before upload: phones send far less data, the server less to check. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  // Browsers that can't write WebP hand back PNG instead; JPEG is then the smaller choice.
  const webp = await encode("image/webp", 0.86);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("This browser couldn't prepare the image");
  return jpeg;
}

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
      body.set("file", await shrink(file), "photo");
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
              <button type="submit" className="btn btn-danger btn-xs">
                <Trash2 aria-hidden="true" />
                {t.remove}
              </button>
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
