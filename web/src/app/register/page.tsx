import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, AuthSwitch } from "@/components/auth-shell";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentTeacher } from "@/server/auth/current";
import { RegisterForm } from "./register-form";

export const instant = false;

export const metadata: Metadata = { title: "শিক্ষক নিবন্ধন" };

export default async function RegisterPage() {
  if (await getCurrentTeacher()) redirect("/dashboard");
  const locale = await getLocale();
  const d = getDictionary(locale);
  return (
    <AuthShell
      locale={locale}
      d={d}
      title={d.register.title}
      lead={d.register.lead}
      footer={<AuthSwitch question={d.register.haveAccount} href="/login" label={d.common.login} />}
    >
      <RegisterForm t={d.register} optional={d.common.optional} />
    </AuthShell>
  );
}
