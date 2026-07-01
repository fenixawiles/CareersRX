"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { LocalCompany } from "@/lib/local-platform";

export function CompanyProfileForm({ company }: { company: LocalCompany }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: company.name,
    website: company.website,
    phone: company.phone,
    contactName: company.contactName,
    contactEmail: company.contactEmail,
    description: company.description,
  });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("Saving company profile…");
    const response = await fetch("/api/employer/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not save company profile.");
      return;
    }
    setStatus("Company profile saved.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Company name" value={form.name} onChange={(value) => update("name", value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" value={form.website} onChange={(value) => update("website", value)} />
        <Field label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary contact" value={form.contactName} onChange={(value) => update("contactName", value)} />
        <Field label="Contact email" value={form.contactEmail} onChange={(value) => update("contactEmail", value)} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{status}</p>
        <Button type="submit" size="md" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none focus-visible:border-primary"
      />
    </div>
  );
}
