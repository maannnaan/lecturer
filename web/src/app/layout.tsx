import type { Metadata } from "next";
import type { ReactNode } from "react";
import { bn } from "@/i18n/bn";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: bn.meta.title, template: "%s · Lecturer.bd" },
  description: bn.meta.description,
};

// Platform pages use the Ink & Paper look; a teacher's site and dashboard re-theme their own
// subtree with data-style. Each area also sets lang on its own wrapper once it knows the
// visitor's language, so <html> keeps the platform default.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={fontVariables}>
      <body data-style="ink">{children}</body>
    </html>
  );
}
