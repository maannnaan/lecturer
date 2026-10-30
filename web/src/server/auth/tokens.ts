import { createHash, randomBytes } from "node:crypto";

/** A new session secret for a cookie: 256 random bits. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores for a token: its SHA-256, so the table alone can't sign anyone in. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
