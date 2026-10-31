/** Why a field was refused; the form shows the matching sentence from the dictionary. */
export type FieldError =
  | "required"
  | "tooLong"
  | "phone"
  | "email"
  | "url"
  | "incomplete"
  | "number"
  | "pricePositive"
  | "dateOrder"
  | "invalid";

export type FieldErrors = Record<string, FieldError>;

/** Form fields as plain strings, which is what both FormData and tests can give. */
export type Input = Record<string, string | undefined>;

export function formInput(formData: FormData): Input {
  const out: Input = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") out[key] = value;
  return out;
}

/**
 * Reads one text field: trimmed, with Windows line endings made plain, and checked against
 * `max` characters. Records "required" or "tooLong" in `errors` under `name`.
 */
export function text(input: Input, name: string, max: number, errors: FieldErrors, required = false): string {
  const value = (input[name] ?? "").replace(/\r\n?/g, "\n").trim();
  if (required && !value) errors[name] = "required";
  else if ([...value].length > max) errors[name] = "tooLong";
  return value;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An https link, or "" when empty. Adds the missing "https://" people often leave off. */
export function url(input: Input, name: string, errors: FieldErrors, allowedHosts?: RegExp): string {
  const raw = (input[name] ?? "").trim();
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("scheme");
    if (allowedHosts && !allowedHosts.test(parsed.hostname)) throw new Error("host");
    return parsed.toString();
  } catch {
    errors[name] = "url";
    return raw;
  }
}
