import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** "Home / Class 9–10 / Physics" — on every inner page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[14px] text-subtle">
      <ol className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
