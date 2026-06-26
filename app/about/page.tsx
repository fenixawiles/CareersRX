import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description: `Learn about ${SITE_NAME} — a connected career profile and job platform starting with healthcare and senior care.`,
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About CareersRX"
        subtitle="Update once. Choose where it syncs. Stay application-ready."
      />
      <div className="prose-job mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p>
          CareersRX is a connected career workspace and job platform. Our first vertical
          is healthcare and senior care, with assisted living, memory care, skilled
          nursing, hospice, and related communities across the southern United States.
        </p>
        <h2>Why we exist</h2>
        <p>
          Professionals should not have to rebuild the same résumé, profile, preferences,
          and application materials for every opportunity. CareersRX starts by making that
          workflow better for caregivers, nurses, and support staff.
        </p>
        <h2>Our commitment</h2>
        <p>
          We verify every hiring community before their jobs go live, hold employers to
          clear standards, and keep the experience warm and simple for everyone involved.
        </p>
      </div>
    </>
  );
}
