import Link from "next/link";
import { allClasses } from "@/lib/data";
import { FEATURED } from "@/lib/site";
import { SiteNav } from "./site-nav";
import { SoonButton } from "./soon-button";

export function Logo() {
  return (
    <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M9 7h6M9 11h4" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface print:hidden">
      {/* One row from 880px; below that the nav takes its own row under the logo and buttons. */}
      <div className="page-x flex flex-wrap items-center gap-x-7 gap-y-3 py-3.5 min-[880px]:gap-y-4">
        <Link href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <Logo />
          <span className="font-display text-[20px] font-bold tracking-[-0.02em]">QBank</span>
        </Link>
        <SiteNav
          classIds={allClasses().map((c) => c.id)}
          fallbackClassId={FEATURED.classId}
          className="order-last -mx-3.5 basis-full min-[880px]:order-none min-[880px]:mx-0 min-[880px]:flex-auto min-[880px]:basis-auto"
        />
        <div className="ml-auto flex items-center gap-2.5 min-[880px]:ml-0">
          <SoonButton
            note="The Bangla version is coming soon."
            className="h-11 rounded-[10px] border border-field bg-surface px-4 font-semibold text-ink hover:bg-page"
          >
            <span lang="bn">বাংলা</span>
          </SoonButton>
          <SoonButton
            note="Sign-in isn't part of this preview yet."
            className="h-11 rounded-[10px] bg-ink px-5 font-semibold text-white hover:bg-ink-soft"
          >
            Sign in
          </SoonButton>
        </div>
      </div>
    </header>
  );
}
