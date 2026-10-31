import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, AuthSwitch } from "@/components/auth-shell";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentTeacher } from "@/server/auth/current";
import { LoginForm } from "./login-form";

export const instant = false;

export const metadata: Metadata = { title: "শিক্ষক লগইন" };

export default async function LoginPage() {
  if (await getCurrentTeacher()) redirect("/dashboard");
  const locale = await getLocale();
  const d = getDictionary(locale);
  return (
    <AuthShell
      locale={locale}
      d={d}
      title={d.login.title}
      lead={d.login.lead}
      footer={<AuthSwitch question={d.login.noAccount} href="/register" label={d.common.register} />}
    >
      <LoginForm t={d.login} />
    </AuthShell>
  );
}
