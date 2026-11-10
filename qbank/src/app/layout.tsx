import type { Metadata } from "next";
import { Hind_Siliguri, Space_Grotesk } from "next/font/google";
import { NavigationProgress } from "@/components/navigation-progress";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "QBank — Every question, sorted by class, subject and chapter",
    template: "%s · QBank",
  },
  description:
    "Creative questions, MCQs and short questions for Class 6 to HSC, chapter by chapter, with past board questions tagged by board and year.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${hind.variable} ${grotesk.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <NavigationProgress />
        <a
          href="#main"
          className="sr-only rounded-[10px] bg-ink px-4 py-3 font-semibold text-white no-underline focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
