"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { Menu } from "lucide-react";

/** The phone menu: a sheet with every dashboard section, closed again after each navigation. */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    menu.current?.removeAttribute("open");
  }, [path]);
  return (
    <details ref={menu} className="dash-menu">
      <summary aria-label={label}>
        <Menu className="size-5" aria-hidden="true" />
      </summary>
      <nav className="dash-menu-panel" aria-label={label}>
        {children}
      </nav>
    </details>
  );
}
