import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveResumeSignupForm } from "@/components/demo/LiveResumeSignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Sandbox Profile",
  description: "Create a no-login CareersRX sandbox profile that generates a live résumé.",
};

export default function LiveResumeSignupPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link
        href="/demo"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to sandbox overview
      </Link>
      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Create the profile, generate the live résumé
        </h1>
        <p className="mt-2 max-w-3xl text-muted">
          This is the no-login version of signup: fill out the same information a real
          candidate would provide, see the public profile it creates, then use the live
          résumé as the easier editing and sync layer.
        </p>
      </div>
      <div className="mt-8">
        <LiveResumeSignupForm />
      </div>
    </div>
  );
}
