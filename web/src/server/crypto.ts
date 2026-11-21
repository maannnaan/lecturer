import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Secrets a teacher entrusts to us (a bKash password and app secret, and the tokens bKash gives
// out) are kept sealed with AES-256-GCM: unreadable without the server's key, and refused if
// altered. The key is SECRETS_KEY, 32 random bytes written as base64 (or hex), set on the server
// alone; without it, nothing that needs one can be saved.

const VERSION = "v1";

/** The server's key, or null when SECRETS_KEY isn't set (or isn't 32 bytes). */
export function secretsKey(raw = process.env.SECRETS_KEY): Buffer | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  return key.length === 32 ? key : null;
}

/** Whether secrets can be sealed here at all. */
export const secretsReady = () => secretsKey() !== null;

/** Seals a secret: "v1.<iv>.<tag>.<ciphertext>", each part base64url. Throws without a key. */
export function sealSecret(plain: string, key: Buffer | null = secretsKey()): string {
  if (!key) throw new Error("SECRETS_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** The secret a sealed value holds, or null: no key, the wrong key, or a value that was altered. */
export function openSecret(sealed: string | null | undefined, key: Buffer | null = secretsKey()): string | null {
  if (!sealed || !key) return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
