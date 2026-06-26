import type { Metadata } from "next";
import { Database, Eye, FilePenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CareersRX Sandbox",
  description: "Try the CareersRX live résumé editor without logging in, using a blank SQLite-backed sandbox.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <Sparkles size={28} />
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground">
          Blank CareersRX sandbox
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          No real account, no seeded person. Create a public-style profile, let it
          generate your first live résumé, then test how section edits sync back only
          when you approve them.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href="/demo/live-resume/signup" size="lg">
            <FilePenLine size={20} /> Create Sandbox Profile
          </Button>
          <Button href="/demo/live-resume" variant="outline" size="lg">
            Open Existing Sandbox
          </Button>
          <Button href="/demo/profile" variant="outline" size="lg">
            <Eye size={20} /> View Public Profile
          </Button>
        </div>
        <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          {[
            "Signup generates résumé",
            "Public profile is separate",
            "Save sections, then approve sync",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-background p-4 text-sm">
              <Database size={16} className="mb-2 text-primary" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
