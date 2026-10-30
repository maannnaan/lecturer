import { describe, expect, it } from "vitest";
import { hashPassword, verifyDecoy, verifyPassword } from "@/server/auth/password";
import { hashToken, newToken } from "@/server/auth/tokens";

describe("passwords", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(stored, "correct horse battery")).toBe(true);
    expect(await verifyPassword(stored, "Correct horse battery")).toBe(false);
  });

  it("treats a damaged stored hash as a failed check, not a crash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });

  it("the decoy check always fails", async () => {
    expect(await verifyDecoy("decoy-password-for-timing")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are long and random, and stored only as a SHA-256", () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
