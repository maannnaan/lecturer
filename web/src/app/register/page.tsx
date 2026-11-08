import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, AuthSwitch } from "@/components/auth-shell";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { HANDLE_MAX, normalizeHandle } from "@/lib/handles";
import { getCurrentTeacher } from "@/server/auth/current";
import { RegisterForm } from "./register-form";

export const instant = false;

export const metadata: Metadata = { title: "শিক্ষক নিবন্ধন" };

type Props = { searchParams: Promise<{ handle?: string | string[] }> };

export default async function RegisterPage({ searchParams }: Props) {
  if (await getCurrentTeacher()) redirect("/dashboard");
  const locale = await getLocale();
  const d = getDictionary(locale);
  // The landing page's address box sends ?handle=; the form checks it properly on submit.
  const asked = (await searchParams).handle;
  const handle = normalizeHandle(typeof asked === "string" ? asked : "").slice(0, HANDLE_MAX);
  return (
    <AuthShell
      locale={locale}
      d={d}
      title={d.register.title}
      lead={d.register.lead}
      footer={<AuthSwitch question={d.register.haveAccount} href="/login" label={d.common.login} />}
    >
      <RegisterForm t={d.register} optional={d.common.optional} initialHandle={handle} />
    </AuthShell>
  );
}
