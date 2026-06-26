import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms of Use" subtitle="The agreement that governs your use of CareersRX." />
      <div className="prose-job mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted">Placeholder — to be reviewed by legal counsel before public launch.</p>
        <h2>Using the service</h2>
        <p>
          By using CareersRX you agree to provide accurate information, respect other users,
          and use the platform only for lawful job-search and hiring purposes.
        </p>
        <h2>Accounts</h2>
        <p>You are responsible for keeping your account credentials secure.</p>
        <h2>Content</h2>
        <p>
          You retain ownership of content you submit and grant us a license to display it as
          part of operating the service.
        </p>
        <h2>Disclaimers</h2>
        <p>
          CareersRX is a platform connecting seekers and employers; we are not a party to
          any employment relationship formed through the service.
        </p>
      </div>
    </>
  );
}
