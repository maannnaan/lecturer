"use client";

import type { ReactNode } from "react";

/** A GET filter form that applies itself when a dropdown changes; text fields wait for the button. */
export function AutoSubmitForm({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <form
      method="get"
      role="search"
      aria-label={label}
      className={className}
      onChange={(event) => {
        if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
