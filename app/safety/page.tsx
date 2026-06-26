import type { Metadata } from "next";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Job Seeker Safety" };

export default function SafetyPage() {
  return (
    <>
      <PageHeader
        title="Job Seeker Safety"
        subtitle="How to stay safe and spot scams during your job search."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="text-primary" size={22} /> What CareersRX will never ask
          </h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li>• We never ask you to pay to apply for a job.</li>
            <li>• We never ask for bank account or payment information to “process” an application.</li>
            <li>• We never ask you to cash a check or forward money on an employer’s behalf.</li>
          </ul>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertTriangle className="text-warning" size={22} /> Warning signs of a scam
          </h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li>• An offer that arrives before any real interview.</li>
            <li>• Requests to move communication off-platform immediately.</li>
            <li>• Pressure to act fast or share sensitive personal data early.</li>
            <li>• Vague employer details or mismatched email domains.</li>
          </ul>
        </div>

        <p className="mt-6 text-muted">
          See something suspicious? Use the report link on any job posting, or contact us
          directly. We review every report.
        </p>
      </div>
    </>
  );
}
