"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthLink } from "@/components/forms/AuthShell";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Sending reset link…");
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not send the reset link.");
      return;
    }
    setDone(true);
    setStatus("");
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Updating password…");
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not reset the password.");
      return;
    }
    setStatus("Password updated. Redirecting to log in…");
    router.push("/login?reset=1");
  }

  if (token) {
    return (
      <form className="space-y-4" onSubmit={confirmReset}>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
          />
        </div>
        <p className="min-h-5 text-sm text-muted">{status}</p>
        <Button type="submit" size="md" className="w-full" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Set New Password
        </Button>
        <p className="text-center text-sm text-muted">
          <AuthLink href="/login">Back to log in</AuthLink>
        </p>
      </form>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-foreground">
          If an account exists for that email, a reset link is on its way. The link expires in one hour.
        </p>
        <p className="text-sm text-muted">
          <AuthLink href="/login">Back to log in</AuthLink>
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={requestLink}>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
        />
      </div>
      <p className="min-h-5 text-sm text-muted">{status}</p>
      <Button type="submit" size="md" className="w-full" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Send Reset Link
      </Button>
      <p className="text-center text-sm text-muted">
        <AuthLink href="/login">Back to log in</AuthLink>
      </p>
    </form>
  );
}
