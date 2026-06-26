import { NextResponse } from "next/server";
import { analyzeSandboxResume } from "@/lib/sqlite-sandbox";
import type { SandboxResumeSection } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { sectionId?: unknown } | null;

  return NextResponse.json(
    analyzeSandboxResume(isResumeSectionId(body?.sectionId) ? body.sectionId : undefined),
  );
}

function isResumeSectionId(value: unknown): value is SandboxResumeSection["id"] {
  return (
    value === "summary" ||
    value === "experience" ||
    value === "credentials" ||
    value === "skills" ||
    value === "preferences"
  );
}
