import { setLanguage } from "@/app/actions";
import type { Locale } from "@/i18n";

/** বাং / EN toggle. A plain form, so it works before (and without) any JavaScript. */
export function LangSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLanguage} className="lang" aria-label={label}>
      <button type="submit" name="locale" value="bn" aria-pressed={locale === "bn"} lang="bn">
        বাং
      </button>
      <button type="submit" name="locale" value="en" aria-pressed={locale === "en"} lang="en">
        EN
      </button>
    </form>
  );
}
