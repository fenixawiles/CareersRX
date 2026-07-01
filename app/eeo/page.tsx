import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { DEFAULT_EEO_STATEMENT } from "@/lib/constants";

export const metadata: Metadata = { title: "Equal Employment Opportunity" };

export default function EeoPage() {
  return (
    <>
      <PageHeader title="Equal Employment Opportunity" />
      <div className="prose-job mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p>{DEFAULT_EEO_STATEMENT}</p>
        <p>
          We expect every employer on CareersRX to uphold these same principles. Job
          postings that contain discriminatory language or unlawful screening criteria are
          not permitted and may be removed if identified.
        </p>
        <p>
          If you believe a posting violates these standards, please report it from the job
          page or contact us directly.
        </p>
      </div>
    </>
  );
}
