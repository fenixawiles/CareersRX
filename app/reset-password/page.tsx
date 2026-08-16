import type { Metadata } from "next";
import { AuthShell } from "@/components/forms/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your CareersRX account password.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  return (
    <AuthShell
      title={token ? "Choose a new password" : "Reset your password"}
      subtitle={
        token
          ? "Set a new password for your CareersRX account."
          : "Enter your account email and we'll send you a reset link."
      }
    >
      <ResetPasswordForm token={token ?? null} />
    </AuthShell>
  );
}
