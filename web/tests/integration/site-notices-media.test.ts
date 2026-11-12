import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseNotice } from "@/lib/courses";
import type { Database } from "@/server/db";
import { media } from "@/server/db/schema";
import { docWithOwnImages, getMedia, saveImage } from "@/server/media";
import { createNotice, deleteNotice, listNotices, updateNotice } from "@/server/notices";
import { setSiteLocale, updateProfile, updateSite } from "@/server/site";
import { findTeacherById } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
beforeAll(async () => {
  db = await freshDb();
});

describe("website settings", () => {
  it("replace only the parts that are saved", async () => {
    const t = await makeTeacher(db);
    await updateSite(db, t.id, { tagline: "সূত্র মুখস্থ নয়", stats: [{ value: "১২+", label: "বছর" }] });
    await updateSite(db, t.id, { contact: { phone: "01700000000" } });
    await updateSite(db, t.id, { stats: [] });
    const site = (await findTeacherById(db, t.id))!.site;
    expect(site).toEqual({ tagline: "সূত্র মুখস্থ নয়", stats: [], contact: { phone: "01700000000" } });
  });

  it("update names on the account and the rest in the settings, together", async () => {
    const t = await makeTeacher(db);
    await updateProfile(
      db,
      t.id,
      { nameBn: "তানভীর আহমেদ", nameEn: "Tanvir Ahmed", subjects: "পদার্থবিজ্ঞান", institution: "ঢাকা" },
      { designation: "প্রভাষক" },
    );
    await setSiteLocale(db, t.id, "en");
    expect(await findTeacherById(db, t.id)).toMatchObject({
      nameBn: "তানভীর আহমেদ",
      subjects: "পদার্থবিজ্ঞান",
      locale: "en",
      site: { designation: "প্রভাষক" },
    });
  });
});

describe("notices", () => {
  it("list pinned first, then newest first", async () => {
    const t = await makeTeacher(db);
    const n = (title: string, pinned = false) => parseNotice({ title, pinned: pinned ? "on" : "" }).notice;
    await createNotice(db, t.id, n("old"));
    await new Promise((r) => setTimeout(r, 5));
    await createNotice(db, t.id, n("pinned", true));
    await new Promise((r) => setTimeout(r, 5));
    await createNotice(db, t.id, n("new"));
    expect((await listNotices(db, t.id)).map((x) => x.title)).toEqual(["pinned", "new", "old"]);
    expect((await listNotices(db, t.id, 2)).map((x) => x.title)).toEqual(["pinned", "new"]);
  });

  it("belong to their teacher alone", async () => {
    const owner = await makeTeacher(db);
    const stranger = await makeTeacher(db);
    const notice = await createNotice(db, owner.id, parseNotice({ title: "মাসিক পরীক্ষা" }).notice);
    expect(await listNotices(db, stranger.id)).toEqual([]);
    expect(await updateNotice(db, stranger.id, notice.id, parseNotice({ title: "x" }).notice)).toBeNull();
    expect(await deleteNotice(db, stranger.id, notice.id)).toBe(false);
    expect(await deleteNotice(db, owner.id, notice.id)).toBe(true);
  });

  it("keep the editor's document beside their plain text, its pictures only the teacher's own", async () => {
    const t = await makeTeacher(db);
    const other = await makeTeacher(db);
    const upload = async (teacherId: string, key: string) =>
      (
        await db
          .insert(media)
          .values({ teacherId, storage: "local", key, url: `/media/${key}`, contentType: "image/webp", bytes: 10 })
          .returning()
      )[0];
    const mine = await upload(t.id, "notice-mine.webp");
    const theirs = await upload(other.id, "notice-theirs.webp");
    const body = (mediaId: string) =>
      JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "ক্লাস ", marks: [{ type: "bold" }] }, { type: "text", text: "রবিবার" }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "বিকেল ৪টা" }] }] }] },
          { type: "image", attrs: { src: "https://elsewhere.example/a.png", mediaId } },
        ],
      });

    const { notice, errors } = parseNotice({ title: "ক্লাসের সময়", body: body(mine.id) });
    expect(errors).toEqual({});
    expect(notice.body).toBe("ক্লাস রবিবার\n\n• বিকেল ৪টা");
    const checked = await docWithOwnImages(db, t.id, notice.bodyRich);
    if (!checked) throw new Error("the teacher's own picture was refused");
    expect(checked.content[2]).toEqual({ type: "image", attrs: { src: "/media/notice-mine.webp", mediaId: mine.id } });
    const saved = await createNotice(db, t.id, { ...notice, bodyRich: checked });
    expect(saved).toMatchObject({ body: notice.body, bodyRich: checked });

    expect(await docWithOwnImages(db, t.id, parseNotice({ title: "x", body: body(theirs.id) }).notice.bodyRich)).toBe(false);
    expect(await docWithOwnImages(db, t.id, null)).toBeNull();
  });
});

describe("images", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lecturer-uploads-"));
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

  beforeAll(() => {
    vi.stubEnv("UPLOADS_DIR", dir);
    vi.stubEnv("LOCAL_UPLOADS", "1");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("are checked, stored in the teacher's own folder and recorded", async () => {
    const t = await makeTeacher(db);
    const saved = await saveImage(db, t.id, jpeg);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.url).toBe(`/media/${t.id}/${saved.id}.jpg`);
    expect(readFileSync(path.join(dir, t.id, `${saved.id}.jpg`))).toEqual(Buffer.from(jpeg));
    expect(await getMedia(db, t.id, saved.id)).toMatchObject({ storage: "local", bytes: jpeg.length });
    expect(await getMedia(db, (await makeTeacher(db)).id, saved.id)).toBeNull();
  });

  it("refuse what isn't an image, or is far too big", async () => {
    const t = await makeTeacher(db);
    expect(await saveImage(db, t.id, new TextEncoder().encode("<svg/>"))).toEqual({ ok: false, reason: "type" });
    expect(await saveImage(db, t.id, new Uint8Array(6 * 1024 * 1024))).toEqual({ ok: false, reason: "size" });
  });
});
