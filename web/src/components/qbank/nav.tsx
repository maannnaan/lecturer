"use client";

import { useRouter } from "next/navigation";
import { type HTMLAttributes, type ReactNode, createContext, useContext, useTransition } from "react";

/**
 * A chapter page's filters reload the page's questions in place. While the next set is on its way
 * the list dims (aria-busy), so a click never looks ignored; tabs and pages are ordinary links.
 */
const QbNav = createContext<{ pending: boolean; go: (href: string) => void }>({ pending: false, go: () => {} });

export function QbNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) => start(() => router.replace(href, { scroll: false }));
  return <QbNav.Provider value={{ pending, go }}>{children}</QbNav.Provider>;
}

export function useQbNav() {
  return useContext(QbNav);
}

/** Its content, dimmed and marked busy while the filters' new questions load. */
export function QbBusy({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const { pending } = useQbNav();
  return (
    <div {...rest} aria-busy={pending || undefined}>
      {children}
    </div>
  );
}
