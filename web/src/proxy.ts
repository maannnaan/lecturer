import { type NextRequest, NextResponse } from "next/server";
import { RESERVED_HANDLES } from "@/lib/handles";
import { ADMIN_COOKIE, TEACHER_COOKIE } from "@/server/auth/cookies";
import { courseVisibility } from "@/server/courses";
import { getDb } from "@/server/db";
import { lookupHandle } from "@/server/teachers";

/**
 * Decisions that need a real HTTP status. With Cache Components a page starts streaming (and so
 * commits to 200) before its layouts run, which turns a redirect() or notFound() there into an
 * in-page instruction. Search engines and browsers should see real 404s and 308s for teacher
 * addresses, and real 307s for signed-out visits to the dashboards, so those are decided here.
 *
 * This is only the first gate. Every page and Server Action still checks the session itself:
 * a cookie being present proves nothing.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [first = "", ...rest] = pathname.slice(1).split("/");
  const tail = rest.length ? `/${rest.join("/")}` : "";

  if (first === "dashboard") {
    return request.cookies.has(TEACHER_COOKIE) ? NextResponse.next() : redirect(request, "/login", 307);
  }
  if (first === "admin" && rest[0] !== "login") {
    return request.cookies.has(ADMIN_COOKIE) ? NextResponse.next() : redirect(request, "/admin/login", 307);
  }
  if (!first || RESERVED_HANDLES.has(first) || first.startsWith("_")) return NextResponse.next();

  // Anything else is a teacher's website: lecturer.bd/<handle>/…
  if (!/^[A-Za-z0-9_-]+$/.test(first)) return notFound(request);
  const handle = first.toLowerCase();
  if (handle !== first) return redirect(request, `/${handle}${tail}${search}`, 308);

  const db = await getDb();
  const site = await lookupHandle(db, handle);
  if (!site) return notFound(request);
  if (!site.current) return redirect(request, `/${site.currentHandle}${tail}${search}`, 308);
  // An unapproved site, or a draft course, is visible only to its owner, who would arrive signed in.
  const signedIn = request.cookies.has(TEACHER_COOKIE);
  if ((site.status === "pending" || site.status === "rejected") && !signedIn) return notFound(request);

  // lecturer.bd/<handle>/courses/<number>
  if (rest[0] === "courses" && rest.length === 2) {
    if (!/^\d{1,6}$/.test(rest[1])) return notFound(request);
    const course = await courseVisibility(db, site.teacherId, Number(rest[1]));
    if (!course || (course === "draft" && !signedIn)) return notFound(request);
  }
  return NextResponse.next();
}

function redirect(request: NextRequest, to: string, status: 307 | 308) {
  return NextResponse.redirect(new URL(to, request.url), status);
}

/** The app's own 404 page, with a real 404 status. */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_not-found", request.url));
}

export const config = {
  // Everything but Next's own assets, API routes, and files with an extension (robots.txt, icons…).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
