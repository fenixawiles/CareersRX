import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Employer Terms" };

export default function EmployerTermsPage() {
  return (
    <>
      <PageHeader
        title="Employer Terms"
        subtitle="Additional terms for communities posting jobs on CareersRX."
      />
      <div className="prose-job mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted">
          These employer terms apply when a company account creates job postings,
          publishes roles, and reviews applicant information on CareersRX.
        </p>
        <h2>Accurate postings</h2>
        <p>
          Employers agree that all job postings are accurate, represent genuine openings, and
          comply with applicable employment and pay-transparency laws.
        </p>
        <h2>Non-discrimination</h2>
        <p>
          Job postings must comply with equal employment opportunity laws and must not contain
          discriminatory language or unlawful screening criteria.
        </p>
        <h2>Publishing and moderation</h2>
        <p>
          Employers control when their postings are published, paused, or closed. We may pause
          or remove postings that violate these terms or applicable law.
        </p>
        <h2>Candidate data</h2>
        <p>
          Applicant information, including resumes, may be used only for legitimate hiring
          purposes and handled in line with our privacy commitments.
        </p>
      </div>
    </>
  );
}
