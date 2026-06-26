import { NextResponse } from "next/server";
import { getSandboxSnapshot, resetSandbox, saveSandboxDraft } from "@/lib/sqlite-sandbox";
import type { SandboxResumeSection } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSandboxSnapshot());
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sections?: unknown;
    title?: unknown;
    targetRole?: unknown;
    sectionId?: unknown;
    namedVersionId?: unknown;
  } | null;

  if (!Array.isArray(body?.sections)) {
    return NextResponse.json({ error: "sections array is required" }, { status: 400 });
  }

  const sections = body.sections.filter(
    (section): section is SandboxResumeSection =>
      typeof section === "object" &&
      section !== null &&
      "id" in section &&
      "title" in section &&
      "helper" in section &&
      "content" in section &&
      typeof (section as { content?: unknown }).content === "string",
  );

  return NextResponse.json(
    saveSandboxDraft(
      sections,
      typeof body.targetRole === "string" ? body.targetRole : "",
      typeof body.title === "string" ? body.title : undefined,
      isResumeSectionId(body.sectionId) ? body.sectionId : undefined,
      undefined,
      typeof body.namedVersionId === "string" ? body.namedVersionId : undefined,
    ),
  );
}

export async function DELETE() {
  return NextResponse.json(resetSandbox());
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
