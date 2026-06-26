import type { Metadata } from "next";
import { AuthShell, AuthLink } from "@/components/forms/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log In" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your CareersRX account"
      footer={
        <>
          New here? <AuthLink href="/register">Create an account</AuthLink>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
