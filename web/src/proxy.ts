import { type NextRequest, NextResponse } from "next/server";
import { isGrade } from "@/lib/grades";
import { RESERVED_HANDLES } from "@/lib/handles";
import { ADMIN_COOKIE, TEACHER_COOKIE } from "@/server/auth/cookies";
import { bankAddress, bankClassAddress } from "@/server/bank";
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

  // lecturer.bd/<handle>/bank[/<class number>[/<subject number>[/<chapter number>]]]. Before
  // teachers named their own classes, the class was a fixed-list key (/bank/hsc/1/4): those
  // addresses are sent on to the class's number.
  if (rest[0] === "bank" && rest.length > 1) {
    const [, cls, subject, chapter] = rest;
    const number = /^\d{1,6}$/;
    if (rest.length > 4 || !(number.test(cls) || isGrade(cls))) return notFound(request);
    if (subject === undefined) {
      const found = await bankClassAddress(db, site.teacherId, cls);
      if (!found) return notFound(request);
      if (String(found.number) !== cls) return redirect(request, `/${handle}/bank/${found.number}${search}`, 308);
    } else {
      if (!number.test(subject) || (chapter !== undefined && !number.test(chapter))) return notFound(request);
      const found = await bankAddress(db, site.teacherId, Number(subject), chapter === undefined ? undefined : Number(chapter));
      if (!found) return notFound(request);
      // A subject moved to another class, or an old address: links follow it.
      if (String(found.classNumber) !== cls) return redirect(request, `/${handle}/bank/${found.classNumber}/${rest.slice(2).join("/")}${search}`, 308);
    }
  }
  // lecturer.bd/<handle>/courses/<number>
  if (rest[0] === "courses" && rest.length > 1) {
    if (rest.length > 2 || !/^\d{1,6}$/.test(rest[1])) return notFound(request);
    const course = await courseVisibility(db, site.teacherId, Number(rest[1]));
    if (!course || (course === "draft" && !signedIn)) return notFound(request);
  }
  return NextResponse.next();
}

function redirect(request: NextRequest, to: string, status: 307 | 308) {
  return NextResponse.redirect(new URL(to, request.url), status);
}

/** The app's own "page not found" page, fetched once per server instance. */
let notFoundHtml: string | null = null;

/**
 * The app's own 404 page, with a real 404 status. A rewrite to /_not-found alone isn't enough:
 * `next start` sends it as a 404, but on Vercel the prerendered page is served as a static file
 * with 200, so search engines would index dead addresses. So the page is answered here directly.
 */
async function notFound(request: NextRequest) {
  if (!notFoundHtml) {
    try {
      const res = await fetch(new URL("/_not-found", request.url), { cache: "no-store" });
      const html = await res.text();
      // A protected preview answers 401 with a sign-in page: never keep that as our 404 page.
      if ((res.ok || res.status === 404) && html.includes("<html")) notFoundHtml = html;
    } catch {
      // fall back to the rewrite below
    }
  }
  if (notFoundHtml) {
    return new NextResponse(notFoundHtml, {
      status: 404,
      // A free address may be taken tomorrow, so the 404 mustn't be cached.
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = {
  // Everything but Next's own assets, API routes, and files with an extension (robots.txt, icons…).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
