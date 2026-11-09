import { setLanguage } from "@/app/actions";
import { PendingButton } from "@/components/form";
import type { Locale } from "@/i18n";

/** বাং / EN toggle. A plain form, so it works before (and without) any JavaScript. */
export function LangSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLanguage} className="lang" aria-label={label}>
      <PendingButton name="locale" value="bn" aria-pressed={locale === "bn"} lang="bn">
        বাং
      </PendingButton>
      <PendingButton name="locale" value="en" aria-pressed={locale === "en"} lang="en">
        EN
      </PendingButton>
    </form>
  );
}
