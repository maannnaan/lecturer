import Link from "next/link";
import { button } from "@/components/ui";
import { cx } from "@/lib/cx";

export default function NotFound() {
  return (
    <main id="main" className="page-x flex w-full flex-col items-start gap-5 pt-16 pb-24">
      <span className="rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-semibold text-accent">404</span>
      <h1 className="m-0 font-display text-[clamp(32px,7vw,44px)] leading-[1.1] font-bold tracking-[-0.03em]">
        We couldn’t find that page.
      </h1>
      <p className="m-0 max-w-[560px] text-[18px] text-muted">
        The class, subject or chapter in this address doesn’t exist. Pick one from the list instead.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link href="/#classes" className={cx(button.accent, "h-11 px-5")}>
          Choose a class
        </Link>
        <Link href="/questions" className={cx(button.outline, "h-11 px-5")}>
          Search questions
        </Link>
      </div>
    </main>
  );
}
