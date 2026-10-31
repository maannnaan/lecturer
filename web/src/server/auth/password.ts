import { hash, verify } from "@node-rs/argon2";

// Argon2id at OWASP's baseline: 19 MiB of memory, 2 passes, 1 lane.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN = 8;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

let decoy: Promise<string> | undefined;

/**
 * Spends the same time as a real password check. Called when no account matches, so a wrong
 * phone number answers as slowly as a wrong password and can't be used to discover accounts.
 */
export async function verifyDecoy(password: string): Promise<false> {
  decoy ??= hashPassword("decoy-password-for-timing");
  await verifyPassword(await decoy, password);
  return false;
}
