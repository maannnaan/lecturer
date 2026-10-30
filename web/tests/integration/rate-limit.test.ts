import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db";
import { clearAttempts, takeAttempt } from "@/server/rate-limit";
import { freshDb } from "../helpers/db";

let db: Database;
beforeAll(async () => {
  db = await freshDb();
});

describe("takeAttempt", () => {
  it("allows the limit within a window, then refuses", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) results.push(await takeAttempt(db, "login:1.2.3.4", 3, 900));
    expect(results).toEqual([true, true, true, false]);
  });

  it("counts each key on its own, and starts over once cleared", async () => {
    for (let i = 0; i < 3; i++) await takeAttempt(db, "login:a", 3, 900);
    expect(await takeAttempt(db, "login:a", 3, 900)).toBe(false);
    expect(await takeAttempt(db, "login:b", 3, 900)).toBe(true);
    await clearAttempts(db, "login:a");
    expect(await takeAttempt(db, "login:a", 3, 900)).toBe(true);
  });
});
