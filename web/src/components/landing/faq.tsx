import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/i18n";

/** Questions as native <details>, so they open and close without JavaScript. */
export function Faq({ items }: { items: Dictionary["landing"]["faq"] }) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>
            <span>{item.q}</span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
