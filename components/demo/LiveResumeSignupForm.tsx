"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { ArrowRight, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SandboxSignupInput, SandboxSnapshot } from "@/lib/sandbox-types";

type FormState = {
  email: string;
  fullName: string;
  headline: string;
  location: string;
  summary: string;
  experience: string;
  skills: string;
  credentials: string;
  preferredRoles: string;
  preferredLocations: string;
};

type SignupImportPrefill = {
  headline: string;
  summary: string;
  experience: string;
  skills: string;
  credentials: string;
  preferredRoles: string;
  preferredLocations: string;
};

type SignupImportResult = {
  review: unknown;
  fileName: string;
  extractedCharCount: number;
  signupPrefill: SignupImportPrefill;
};

const emptyForm: FormState = {
  email: "",
  fullName: "",
  headline: "",
  location: "",
  summary: "",
  experience: "",
  skills: "",
  credentials: "",
  preferredRoles: "",
  preferredLocations: "",
};

const sampleForm: FormState = {
  email: "you@example.com",
  fullName: "Jordan Avery",
  headline: "Operations Manager",
  location: "Austin, TX",
  summary:
    "Operations leader with experience improving team workflows, onboarding, scheduling, and customer-facing communication.",
  experience:
    "Operations Lead, Northstar Services\n• Improved onboarding completion by standardizing first-week checklists.\n• Coordinated weekly staffing plans across a 20-person team.\n• Built reporting rhythms for leadership updates and customer escalations.",
  skills: "Team leadership, Scheduling, Process improvement, Customer communication, Reporting",
  credentials: "Google Project Management Certificate, CPR",
  preferredRoles: "Operations Manager, Program Manager, Customer Operations Lead",
  preferredLocations: "Austin, Remote, Dallas",
};

function listFromText(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\n|,|·|•|;/)
    .map((item) => item.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function LiveResumeSignupForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importingResume, setImportingResume] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    function handleSignupImportApply(event: Event) {
      const detail = (event as CustomEvent<{ signupPrefill?: SignupImportPrefill }>).detail;
      if (!detail?.signupPrefill) return;
      setForm((current) => ({
        ...current,
        headline: detail.signupPrefill?.headline || current.headline,
        summary: detail.signupPrefill?.summary || current.summary,
        experience: detail.signupPrefill?.experience || current.experience,
        skills: detail.signupPrefill?.skills || current.skills,
        credentials: detail.signupPrefill?.credentials || current.credentials,
        preferredRoles: detail.signupPrefill?.preferredRoles || current.preferredRoles,
        preferredLocations: detail.signupPrefill?.preferredLocations || current.preferredLocations,
      }));
      setImportStatus("Rex import applied to the sandbox fields. Review before creating the profile.");
    }

    window.addEventListener("careersrx:resume-import-signup-apply", handleSignupImportApply);
    return () => window.removeEventListener("careersrx:resume-import-signup-apply", handleSignupImportApply);
  }, []);

  async function uploadResumeForSignup(file: File | null) {
    if (!file) return;
    setImportingResume(true);
    setImportStatus("Uploading résumé and asking Rex to organize it…");
    window.dispatchEvent(
      new CustomEvent("careersrx:rex-import-progress", {
        detail: {
          fileName: file.name,
          intent: "signup_onboarding",
        },
      }),
    );
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/auth/register/seeker/import-resume", {
      method: "POST",
      body: formData,
    });
    setImportingResume(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      const error = data?.error ?? "Rex could not import that résumé.";
      window.dispatchEvent(new CustomEvent("careersrx:rex-import-error", { detail: { error } }));
      setImportStatus(error);
      return;
    }
    const result = (await response.json()) as SignupImportResult;
    window.dispatchEvent(
      new CustomEvent("careersrx:rex-import-review", {
        detail: {
          resumeImport: null,
          review: result.review,
          applyMode: "fill_signup_fields",
          applyLabel: "Fill Sign-Up Fields",
          fileName: result.fileName,
          extractedCharCount: result.extractedCharCount,
          signupPrefill: result.signupPrefill,
        },
      }),
    );
    setImportStatus("Rex prepared an import review. Use the Rex drawer to apply it to the form.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Creating profile and live résumé…");

    const payload: SandboxSignupInput = {
      email: form.email,
      fullName: form.fullName,
      headline: form.headline,
      location: form.location,
      summary: form.summary,
      experience: form.experience,
      skills: listFromText(form.skills),
      credentials: listFromText(form.credentials),
      preferredRoles: listFromText(form.preferredRoles),
      preferredLocations: listFromText(form.preferredLocations),
    };

    const response = await fetch("/api/demo/live-resume/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus("Could not create the sandbox profile.");
      return;
    }

    const snapshot = (await response.json()) as SandboxSnapshot;
    setStatus(`Created ${snapshot.resume.title}. Opening editor…`);
    startTransition(() => router.push("/demo/live-resume"));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light/50 p-4">
        <div>
          <h2 className="font-semibold text-foreground">Create a sandbox profile</h2>
          <p className="mt-1 text-sm text-muted">
            These fields create the public-facing profile and generate the first live
            résumé. Later, section saves can update this profile or stay résumé-only.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setForm(sampleForm)}>
          <Sparkles size={16} /> Fill Sample
        </Button>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 md:grid-cols-2">
        <TextInput
          label="Email"
          value={form.email}
          onChange={(value) => updateField("email", value)}
          type="email"
          placeholder="you@example.com"
        />
        <TextInput
          label="Full name"
          value={form.fullName}
          onChange={(value) => updateField("fullName", value)}
          placeholder="Your name"
          required
        />
        <TextInput
          label="Headline / target role"
          value={form.headline}
          onChange={(value) => updateField("headline", value)}
          placeholder="Operations Manager"
        />
        <TextInput
          label="Location"
          value={form.location}
          onChange={(value) => updateField("location", value)}
          placeholder="Austin, TX"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="font-semibold text-foreground">Optional: upload résumé for Rex prefill</h3>
          <p className="mt-1 text-sm text-muted">
            Upload a PDF or DOCX. Rex reviews the extracted résumé before filling the sandbox fields.
          </p>
          {importStatus ? <p className="mt-2 text-sm text-muted">{importStatus}</p> : null}
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-primary-light">
          {importingResume ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Upload Resume
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = "";
              void uploadResumeForSignup(file);
            }}
          />
        </label>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 lg:grid-cols-2">
        <TextArea
          label="Professional summary"
          value={form.summary}
          onChange={(value) => updateField("summary", value)}
          placeholder="A short summary that will become the résumé summary and profile summary."
        />
        <TextArea
          label="Experience"
          value={form.experience}
          onChange={(value) => updateField("experience", value)}
          placeholder="Role, company, and bullets. This becomes the résumé experience section."
        />
        <TextArea
          label="Skills"
          value={form.skills}
          onChange={(value) => updateField("skills", value)}
          placeholder="Comma or line separated skills"
        />
        <TextArea
          label="Credentials"
          value={form.credentials}
          onChange={(value) => updateField("credentials", value)}
          placeholder="Licenses, certifications, clearances, degrees"
        />
        <TextArea
          label="Preferred roles"
          value={form.preferredRoles}
          onChange={(value) => updateField("preferredRoles", value)}
          placeholder="Operations Manager, Program Manager"
        />
        <TextArea
          label="Preferred locations"
          value={form.preferredLocations}
          onChange={(value) => updateField("preferredLocations", value)}
          placeholder="Austin, Remote"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{status || "No real account is created; this is the SQLite sandbox."}</p>
        <Button type="submit" size="lg" disabled={isPending || !form.fullName.trim()}>
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          Create Profile + Live Résumé
        </Button>
      </div>
    </form>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-").replaceAll("/", "");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[130px] w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus-visible:border-primary"
      />
    </div>
  );
}
