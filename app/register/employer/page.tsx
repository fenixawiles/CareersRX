import type { Metadata } from "next";
import { AuthShell, TextField, AuthLink } from "@/components/forms/AuthShell";
import { Button } from "@/components/ui/Button";

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
      {/* Auth backend + company verification wired in Phase 2–4. */}
      <form className="space-y-4">
        <TextField label="Community / company name" name="companyName" required />
        <TextField label="Work email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <Button type="submit" size="md" className="w-full">
          Create Account
        </Button>
        <p className="text-xs text-muted">
          Your community will be verified before jobs go live. By continuing you agree to our{" "}
          <AuthLink href="/terms/employers">Employer Terms</AuthLink>.
        </p>
      </form>
    </AuthShell>
  );
}
