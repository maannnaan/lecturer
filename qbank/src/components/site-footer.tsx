import Link from "next/link";

const LINKS = ["About", "Contribute questions", "Contact", "Privacy"];

export function SiteFooter() {
  return (
    <footer className="on-dark bg-ink text-footer print:hidden">
      <div className="page-x flex flex-wrap items-center justify-between gap-6 py-10">
        <span className="font-display text-[18px] font-bold text-white">QBank</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-5 text-[15px]">
          {/* Placeholder pages in the mockup; they lead to the explainer on the home page for now. */}
          {LINKS.map((label) => (
            <Link key={label} href="/#types" className="text-footer hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
