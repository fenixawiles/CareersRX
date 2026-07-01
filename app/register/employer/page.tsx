import type { Metadata } from "next";
import { EmployerAccountSignupForm } from "@/components/auth/EmployerAccountSignupForm";
import { AuthShell, AuthLink } from "@/components/forms/AuthShell";

export const metadata: Metadata = { title: "Create an Employer Account" };

export default function EmployerRegisterPage() {
  return (
    <AuthShell
      title="Start hiring"
      subtitle="Create your community's employer account"
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <EmployerAccountSignupForm />
      <p className="mt-4 text-xs text-muted">
        By continuing you agree to our <AuthLink href="/terms/employers">Employer Terms</AuthLink>.
      </p>
    </AuthShell>
  );
}
