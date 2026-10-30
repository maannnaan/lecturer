import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentAdmin } from "@/server/auth/current";
import { AdminLoginForm } from "./admin-login-form";

export const instant = false;

export const metadata: Metadata = { title: "অ্যাডমিন লগইন", robots: { index: false } };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  const locale = await getLocale();
  const d = getDictionary(locale);
  return (
    <AuthShell locale={locale} d={d} title={d.admin.loginTitle} lead="Lecturer.bd">
      <AdminLoginForm
        t={{ email: d.admin.email, password: d.admin.password, submit: d.admin.submit }}
        pending={d.login.submitting}
      />
    </AuthShell>
  );
}
