/**
 * Shrinks an image in the browser before upload, so phones send far less data and the server has
 * less to check. Browser-only (canvas); used by the photo and question-image uploaders.
 */
export async function shrinkImage(file: File, longestSide = 1200): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  // Diagrams are often transparent PNGs: give them a white page rather than black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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

/** Uploads one image for the signed-in teacher. Returns the media id and URL, or an error code. */
export async function uploadImage(file: File): Promise<{ id: string; url: string } | { error: string }> {
  try {
    const body = new FormData();
    body.set("file", await shrinkImage(file), "image");
    const res = await fetch("/api/media", { method: "POST", body });
    const answer = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
    if (!res.ok || !answer.id || !answer.url) return { error: answer.error ?? "failed" };
    return { id: answer.id, url: answer.url };
  } catch {
    return { error: "failed" };
  }
}
