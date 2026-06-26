import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicProfilePreview } from "@/components/demo/PublicProfilePreview";
import { getSandboxSnapshot } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Public Profile Preview",
  description: "View the public-facing CareersRX profile generated from approved live résumé syncs.",
};

export default function DemoProfilePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href="/demo"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to sandbox overview
      </Link>
      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Public profile preview
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          The profile employers would see
        </h1>
        <p className="mt-2 max-w-3xl text-muted">
          This page is intentionally separate from the live résumé. It only reflects
          profile details that were created at signup or approved through résumé sync.
        </p>
      </div>
      <div className="mt-8">
        <PublicProfilePreview snapshot={getSandboxSnapshot()} />
      </div>
    </div>
  );
}
