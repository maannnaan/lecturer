import "server-only";
import type { FormState } from "@/components/form";
import { type Dictionary, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import type { FieldError, FieldErrors, Input } from "@/lib/form-input";

/** The sentence for each reason a field can be refused, in the visitor's language. */
function messages(e: Dictionary["errors"]): Record<FieldError, string> {
  return {
    required: e.required,
    tooLong: e.tooLong,
    phone: e.phone,
    email: e.email,
    url: e.url,
    incomplete: e.incomplete,
    number: e.number,
    pricePositive: e.pricePositive,
    dateOrder: e.dateOrder,
    invalid: e.invalid,
  };
}

export async function errorTexts(): Promise<Dictionary["errors"]> {
  return getDictionary(await getLocale()).errors;
}

/**
 * The answer to a refused form: each field's message in the visitor's language, and what was
 * typed so nothing is lost. Returns null when there's nothing to refuse.
 */
export async function refused(errors: FieldErrors, input: Input): Promise<FormState | null> {
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;
  const text = messages(await errorTexts());
  return {
    errors: Object.fromEntries(keys.map((k) => [k, text[errors[k]]])),
    values: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? ""])),
  };
}
