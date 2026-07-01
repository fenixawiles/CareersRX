import type { Metadata } from "next";
import { LiveResumeSandbox } from "@/components/demo/LiveResumeSandbox";
import { getSandboxSnapshot } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Résumé Sandbox",
  description: "Test signup-generated CareersRX live résumé editing without logging in, backed by SQLite persistence.",
};

export default function LiveResumeSandboxPage() {
  return (
    <div className="mx-auto max-w-[1560px] px-4 py-8 sm:px-6">
      <LiveResumeSandbox initialSnapshot={getSandboxSnapshot()} />
    </div>
  );
}
