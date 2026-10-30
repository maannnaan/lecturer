"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LANG_COOKIE, langCookieOptions } from "@/server/auth/cookies";
import { isLocale } from "@/i18n";

/** Remembers the visitor's language choice and re-renders the page in it. */
export async function setLanguage(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, langCookieOptions());
  refresh();
}
