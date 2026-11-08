import { ArrowRight } from "lucide-react";
import type { Dictionary } from "@/i18n";
import { HANDLE_MAX } from "@/lib/handles";

/**
 * "lecturer.bd/[ your-name ] → Claim it". A plain GET form to /register, which fills the
 * address field from ?handle=, so it works before any JavaScript loads. The sign-up form does
 * the real checking.
 */
export function ClaimForm({ t, id, onDark = false }: { t: Dictionary["landing"]["claim"]; id: string; onDark?: boolean }) {
  return (
    <form action="/register" method="get" className={onDark ? "claim claim-on-dark" : "claim"}>
      <label htmlFor={id} className="sr-only">
        {t.label}
      </label>
      <div className="input-group claim-field">
        <span className="prefix" aria-hidden="true">
          lecturer.bd/
        </span>
        <input
          id={id}
          name="handle"
          className="input"
          placeholder={t.placeholder}
          maxLength={HANDLE_MAX}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button type="submit" className="btn btn-primary claim-btn">
        {t.button}
        <ArrowRight aria-hidden="true" />
      </button>
    </form>
  );
}
