import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SeekerAccountSignupForm } from "@/components/auth/SeekerAccountSignupForm";
import { AuthLink } from "@/components/forms/AuthShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create a Job Seeker Account" };

export default function SeekerRegisterPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/register"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to account options
      </Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create your job seeker account
          </h1>
          <p className="mt-2 max-w-3xl text-muted">
            This is a real local SQLite signup. Your profile becomes the public-facing
            job board profile, and CareersRX generates a live résumé you can use to keep
            that profile current.
          </p>
        </div>
        <p className="text-sm text-muted">
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </p>
      </div>
      <div className="mt-8">
        <SeekerAccountSignupForm />
      </div>
    </div>
  );
}
