/**
 * Teacher website addresses: lecturer.bd/<handle>.
 *
 * A handle sits at the root of the site, beside the platform's own pages, so anything that is or
 * may become a top-level route is reserved. tests/unit/handles.test.ts fails when a folder in
 * src/app is missing from RESERVED_HANDLES.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // top-level routes in src/app
  "admin", "api", "dashboard", "login", "register",
  // likely future platform pages
  "about", "help", "support", "contact", "pricing", "plans", "terms", "privacy", "policy", "blog",
  "docs", "faq", "search", "find", "explore", "home", "index", "settings", "account", "profile",
  "teachers", "teacher", "students", "student", "result", "results", "exam", "exams", "live",
  "omr", "scanner", "app", "apps", "download", "downloads", "static", "assets", "public",
  "images", "img", "fonts", "robots", "sitemap", "manifest", "logout", "signup", "signin",
  "sign-up", "sign-in", "auth", "oauth", "callback", "verify", "reset", "password", "forgot",
  "billing", "payment", "payments", "pay", "checkout", "bkash", "nagad", "invoice", "invoices",
  "receipt", "receipts", "notice", "notices", "news", "course", "courses", "library", "bank",
  "question", "questions", "paper", "papers", "batch", "batches", "new", "edit", "create",
  // the platform's own names and system words
  "lecturer", "lecturerbd", "lecturer-bd", "lecturer_bd", "official", "staff", "team", "root",
  "system", "null", "undefined", "www", "mail", "email", "ftp", "cdn", "_site", "site", "sites",
  "test", "tests", "demo", "example",
]);

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export type HandleProblem = "length" | "chars" | "edge" | "reserved";

/** Why `handle` (already normalised) can't be a teacher's address, or null if it can. */
export function handleProblem(handle: string): HandleProblem | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return "length";
  if (!/^[a-z0-9_-]+$/.test(handle)) return "chars";
  if (!/^[a-z0-9]/.test(handle) || !/[a-z0-9]$/.test(handle)) return "edge";
  if (RESERVED_HANDLES.has(handle)) return "reserved";
  return null;
}
