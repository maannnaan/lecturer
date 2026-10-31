import { cacheLife } from "next/cache";

/**
 * This year, for copyright lines. Cached for a day, so reading the clock never happens during a
 * prerender (Cache Components refuses an uncached `new Date()` there).
 */
export async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
