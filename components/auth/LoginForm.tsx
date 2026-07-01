"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthLink } from "@/components/forms/AuthShell";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Logging in…");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not log in.");
      return;
    }

    const data = (await response.json().catch(() => null)) as { dashboardPath?: string } | null;
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = next?.startsWith("/") ? next : data?.dashboardPath ?? "/dashboard/seeker/profile";
    setStatus("Logged in. Opening your dashboard…");
    startTransition(() => router.push(destination));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <AuthLink href="/forgot-password">Forgot?</AuthLink>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
        />
      </div>
      <p className="min-h-5 text-sm text-muted">{status}</p>
      <Button type="submit" size="md" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        Log In
      </Button>
    </form>
  );
}
