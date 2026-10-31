import Link from "next/link";
import { Logo } from "@/components/logo";

// Static on purpose (no cookie read): shown for unknown addresses and for teacher sites that
// aren't public, in both languages at once.
export default function NotFound() {
  return (
    <main className="wrap flex min-h-dvh flex-col items-start justify-center gap-5 py-16">
      <Link href="/" aria-label="Lecturer.bd">
        <Logo />
      </Link>
      <h1 className="text-4xl">পাতাটি পাওয়া যায়নি</h1>
      <p className="text-lg text-ink-2">এই ঠিকানায় কোনো পাতা নেই, অথবা এখানকার ওয়েবসাইটটি এখনো সবার জন্য খোলা হয়নি।</p>
      <p className="text-ink-2" lang="en">
        Page not found. This address has no page, or the website here isn&apos;t public yet.
      </p>
      <Link href="/" className="btn btn-primary">
        Lecturer.bd হোম
      </Link>
    </main>
  );
}
