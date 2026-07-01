"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function EmployerAccountSignupForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Creating employer account…");

    const response = await fetch("/api/auth/register/employer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, contactName, email, password }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not create employer account.");
      return;
    }

    const data = (await response.json().catch(() => null)) as { dashboardPath?: string } | null;
    setStatus("Employer account created. Opening your dashboard…");
    startTransition(() => router.push(data?.dashboardPath ?? "/dashboard/employer"));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Company / community name"
        value={companyName}
        onChange={setCompanyName}
        autoComplete="organization"
        required
      />
      <Field
        label="Primary contact name"
        value={contactName}
        onChange={setContactName}
        autoComplete="name"
        required
      />
      <Field
        label="Work email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
      />
      <p className="min-h-5 text-sm text-muted">{status}</p>
      <Button type="submit" size="md" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
        Create Employer Account
      </Button>
      <p className="text-xs leading-5 text-muted">
        Your company workspace is created immediately. Jobs stay private until you publish them.
      </p>
    </form>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
      />
    </div>
  );
}
