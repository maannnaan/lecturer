"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { getDictionary, isLocale } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { formInput } from "@/lib/form-input";
import { handleProblem, normalizeHandle } from "@/lib/handles";
import { parseContact, parseHighlights, parseProfile, parseRoutine } from "@/lib/site";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getMedia } from "@/server/media";
import { setSiteLocale, updateProfile, updateSite } from "@/server/site";
import { TakenError, changeHandle } from "@/server/teachers";
import { refused } from "../form-state";

// Every action re-reads the session: a form posting here proves nothing about who sent it.

const saved: FormState = { ok: true, errors: {} };

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { account, site, errors } = parseProfile(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  await updateProfile(await getDb(), teacher.id, account, site);
  refresh();
  return saved;
}

export async function saveHighlightsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { site, errors } = parseHighlights(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  await updateSite(await getDb(), teacher.id, site);
  refresh();
  return saved;
}

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { site, errors } = parseContact(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  await updateSite(await getDb(), teacher.id, site);
  refresh();
  return saved;
}

export async function saveRoutineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { site, errors } = parseRoutine(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  await updateSite(await getDb(), teacher.id, site);
  refresh();
  return saved;
}

export async function saveLanguageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const locale = formData.get("locale");
  if (!isLocale(locale)) return { errors: {} };
  await setSiteLocale(await getDb(), teacher.id, locale);
  refresh();
  return saved;
}

export async function changeHandleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const d = getDictionary(await getLocale());
  const typed = String(formData.get("handle") ?? "");
  const handle = normalizeHandle(typed);
  const values = { handle: typed };
  const problem = handleProblem(handle);
  const message = problem
    ? { length: d.errors.handleLength, chars: d.errors.handleChars, edge: d.errors.handleEdge, reserved: d.errors.handleReserved }[
        problem
      ]
    : handle === teacher.handle
      ? d.dashboard.website.address.same
      : null;
  if (message) return { errors: { handle: message }, values };
  try {
    await changeHandle(await getDb(), teacher.id, handle);
  } catch (err) {
    if (err instanceof TakenError) return { errors: { handle: d.errors.handleTaken }, values };
    throw err;
  }
  refresh();
  return saved;
}

/** Makes an image the teacher just uploaded their website photo. Only their own uploads count. */
export async function setPhotoAction(mediaId: string): Promise<{ ok: boolean }> {
  const teacher = await requireTeacher();
  const db = await getDb();
  const image = await getMedia(db, teacher.id, mediaId);
  if (!image) return { ok: false };
  await updateSite(db, teacher.id, { photo: { mediaId: image.id, url: image.url } });
  refresh();
  return { ok: true };
}

export async function removePhotoAction() {
  const teacher = await requireTeacher();
  await updateSite(await getDb(), teacher.id, { photo: null });
  refresh();
}
