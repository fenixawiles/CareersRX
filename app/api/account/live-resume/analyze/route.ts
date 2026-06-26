import { NextResponse } from "next/server";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { analyzeSandboxResume } from "@/lib/sqlite-sandbox";
import type { SandboxResumeSection } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isResumeSectionId(value: unknown): value is SandboxResumeSection["id"] {
  return (
    value === "summary" ||
    value === "experience" ||
    value === "credentials" ||
    value === "skills" ||
    value === "preferences"
  );
}

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sectionId?: unknown } | null;
  return NextResponse.json(
    analyzeSandboxResume(
      isResumeSectionId(body?.sectionId) ? body.sectionId : undefined,
      sandboxIdForUser(user.id),
    ),
  );
}
