import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { bn } from "@/i18n/bn";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: bn.meta.title, template: "%s · Lecturer.bd" },
  description: bn.meta.description,
};

// Platform pages and dashboards use the platform's own look ("app"); a teacher's public website
// re-themes its subtree with the teacher's choice. Each area also sets lang on its own wrapper
// once it knows the visitor's language, so <html> keeps the platform default.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={fontVariables}>
      <body data-style="app">
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
