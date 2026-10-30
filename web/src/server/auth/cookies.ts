export const ADMIN_COOKIE = "lba";
export const TEACHER_COOKIE = "lbt";
export const LANG_COOKIE = "lb_lang";

/**
 * A student's session cookie is named after the teacher whose site they signed in to, so one
 * browser can be signed in to two teachers' sites at once, each with its own separate account.
 */
export function studentCookie(teacherId: string): string {
  return `lbs_${teacherId.replaceAll("-", "")}`;
}

// The cookie itself outlives the session; the database decides when a session has expired.
const COOKIE_MAX_AGE = 400 * 86_400;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export function langCookieOptions() {
  return { path: "/", sameSite: "lax" as const, maxAge: COOKIE_MAX_AGE };
}
