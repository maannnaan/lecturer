import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/server/db";
import { resolveHandle } from "@/server/teachers";

/**
 * The owner of lecturer.bd/<handle>, looked up once per request for the layout, page and metadata.
 * A teacher's site reflects edits immediately, so it is never prerendered: `connection()` stops
 * Next from trying to build it ahead of a real request.
 */
export const getSite = cache(async (handle: string) => {
  await connection();
  return resolveHandle(await getDb(), handle);
});
