import { asciiDigits } from "./digits";

/**
 * A Bangladesh mobile number in its one stored form, 01XXXXXXXXX, or null if it isn't one.
 * Accepts what people actually type: a +880 / 880 prefix, spaces and dashes, Bangla digits.
 */
export function normalizePhone(raw: string): string | null {
  let digits = asciiDigits(raw).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("880")) digits = "0" + digits.slice(3);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}
