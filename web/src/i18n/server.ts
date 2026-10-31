import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "@/server/auth/cookies";
import { DEFAULT_LOCALE, type Locale, isLocale } from "./index";

/**
 * The language to render this request in: the visitor's own choice if they made one, otherwise
 * `fallback` (a teacher's website passes its own default; platform pages use Bangla).
 */
export async function getLocale(fallback: Locale = DEFAULT_LOCALE): Promise<Locale> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(chosen) ? chosen : fallback;
}
