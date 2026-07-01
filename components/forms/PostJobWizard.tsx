"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, MapPin, DollarSign, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  JOB_CATEGORIES,
  FOCUS_STATES,
  JOB_TYPE_LABELS,
  SHIFT_LABELS,
  FACILITY_TYPE_LABELS,
  DEFAULT_EEO_STATEMENT,
} from "@/lib/constants";

const STEPS = ["Basics", "Location", "Details", "Review"];

type FormState = {
  title: string;
  category: string;
  facilityType: string;
  jobType: string;
  shifts: string[];
  city: string;
  state: string;
  zip: string;
  description: string;
  requirements: string;
  benefits: string;
  salaryMin: string;
  salaryMax: string;
  payType: string;
  eeoStatement: string;
};

const initial: FormState = {
  title: "",
  category: JOB_CATEGORIES[0],
  facilityType: "ASSISTED_LIVING",
  jobType: "FULL_TIME",
  shifts: ["DAY"],
  city: "",
  state: "FL",
  zip: "",
  description: "",
  requirements: "",
  benefits: "",
  salaryMin: "",
  salaryMax: "",
  payType: "HOURLY",
  eeoStatement: DEFAULT_EEO_STATEMENT,
};

export function PostJobWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleShift(shift: string) {
    setForm((f) => ({
      ...f,
      shifts: f.shifts.includes(shift)
        ? f.shifts.filter((s) => s !== shift)
        : [...f.shifts, shift],
    }));
  }

  async function submitJob() {
    setSubmitting(true);
    setStatus("Saving job posting…");
    const response = await fetch("/api/employer/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(data?.error ?? "Could not save job posting.");
      return;
    }
    setStatus("");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e3f0e9] text-success">
          <Check size={28} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Job saved as a draft</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Your posting <span className="font-medium text-foreground">“{form.title}”</span> has been
          saved to your employer dashboard. Publish it when you are ready for candidates to see it.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button href="/dashboard/employer/jobs" variant="outline" size="sm">
            Back to Jobs
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setForm(initial);
              setStep(0);
              setSubmitted(false);
            }}
          >
            Post Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                i < step
                  ? "bg-success text-white"
                  : i === step
                    ? "bg-primary text-white"
                    : "bg-primary-light text-muted"
              }`}
            >
              {i < step ? <Check size={16} /> : i + 1}
            </span>
            <span
              className={`hidden text-sm font-medium sm:inline ${
                i === step ? "text-foreground" : "text-muted"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border bg-surface p-6">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Job title">
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Certified Nursing Assistant"
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  className="input"
                >
                  {JOB_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Facility type">
                <select
                  value={form.facilityType}
                  onChange={(e) => update("facilityType", e.target.value)}
                  className="input"
                >
                  {Object.entries(FACILITY_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Job type">
              <div className="flex flex-wrap gap-2">
                {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
                  <Chip key={v} active={form.jobType === v} onClick={() => update("jobType", v)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Shifts">
              <div className="flex flex-wrap gap-2">
                {Object.entries(SHIFT_LABELS).map(([v, l]) => (
                  <Chip key={v} active={form.shifts.includes(v)} onClick={() => toggleShift(v)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City">
                <input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="e.g. Tampa"
                  className="input"
                />
              </Field>
              <Field label="State">
                <select
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  className="input"
                >
                  {FOCUS_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="ZIP code">
              <input
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
                placeholder="33601"
                className="input sm:max-w-[180px]"
              />
            </Field>
            <div className="rounded-xl bg-primary-light/50 p-4 text-sm text-primary-dark">
              Pay-transparency states (e.g. CA) require a salary range. We’ll prompt for it on
              the next step.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={5}
                placeholder="Describe the role and your community…"
                className="input"
              />
            </Field>
            <Field label="Requirements">
              <textarea
                value={form.requirements}
                onChange={(e) => update("requirements", e.target.value)}
                rows={3}
                placeholder="Licenses, experience, qualifications…"
                className="input"
              />
            </Field>
            <Field label="Benefits">
              <textarea
                value={form.benefits}
                onChange={(e) => update("benefits", e.target.value)}
                rows={3}
                placeholder="Health insurance, PTO, 401(k)…"
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Pay type">
                <select
                  value={form.payType}
                  onChange={(e) => update("payType", e.target.value)}
                  className="input"
                >
                  <option value="HOURLY">Hourly</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="PER_DIEM">Per diem</option>
                </select>
              </Field>
              <Field label="Salary min ($)">
                <input
                  value={form.salaryMin}
                  onChange={(e) => update("salaryMin", e.target.value)}
                  placeholder="18.00"
                  className="input"
                />
              </Field>
              <Field label="Salary max ($)">
                <input
                  value={form.salaryMax}
                  onChange={(e) => update("salaryMax", e.target.value)}
                  placeholder="24.00"
                  className="input"
                />
              </Field>
            </div>
            <Field label="Equal opportunity statement">
              <textarea
                value={form.eeoStatement}
                onChange={(e) => update("eeoStatement", e.target.value)}
                rows={3}
                className="input"
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {form.title || "Untitled role"}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} /> {form.city || "—"}, {form.state}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={15} /> {JOB_TYPE_LABELS[form.jobType]}
              </span>
              {form.salaryMin ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <DollarSign size={15} /> ${form.salaryMin}
                  {form.salaryMax ? ` – $${form.salaryMax}` : ""}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">{FACILITY_TYPE_LABELS[form.facilityType]}</Badge>
              {form.shifts.map((s) => (
                <Badge key={s} tone="neutral">
                  {SHIFT_LABELS[s]}
                </Badge>
              ))}
            </div>
            {form.description ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{form.description}</p>
            ) : (
              <p className="text-sm text-muted">No description added yet.</p>
            )}
            <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
              <input type="checkbox" className="mt-1" defaultChecked />
              <span>
                I confirm this posting is accurate, represents a genuine opening, and complies
                with equal employment opportunity laws.
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="ghost"
          size="md"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={step === 0 ? "invisible" : ""}
        >
          <ChevronLeft size={18} /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="md" onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight size={18} />
          </Button>
        ) : (
          <Button size="md" onClick={submitJob} disabled={submitting}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Posting
          </Button>
        )}
      </div>
      <p className="mt-3 min-h-5 text-right text-sm text-muted">{status}</p>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          padding: 0.625rem 0.75rem;
          outline: none;
        }
        .input:focus-visible { border-color: var(--color-primary); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-surface text-foreground hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}
