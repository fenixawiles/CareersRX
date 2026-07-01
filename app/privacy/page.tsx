import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy Policy" subtitle="How we collect, use, and protect your information." />
      <div className="prose-job mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted">
          CareersRX uses the information you provide to operate your account, profile,
          live résumé, applications, saved jobs, and employer hiring workspace.
        </p>
        <h2>Information we collect</h2>
        <p>
          Account details (name, email), profile information you provide, resumes you upload,
          and usage data needed to operate the service.
        </p>
        <h2>How we use it</h2>
        <p>
          To connect job seekers with employers, deliver the service, and keep the platform
          safe. We do not sell your personal information.
        </p>
        <h2>Resume processing</h2>
        <p>
          Uploaded resumes may be processed by a third-party malware scanning service for
          security. Files are transmitted for scanning and are not retained by that service
          beyond the scan request.
        </p>
        <h2>Data retention &amp; deletion</h2>
        <p>
          You may delete your account at any time. We retain limited records as required for
          legal and operational reasons, then anonymize remaining data.
        </p>
        <h2>Your rights</h2>
        <p>Contact us to access, correct, or delete your personal information.</p>
      </div>
    </>
  );
}
