import { NextResponse } from "next/server";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { getSandboxSnapshot, resetSandbox, saveSandboxDraft } from "@/lib/resume/store";
import type { SandboxResumeSection } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SeekerAuth =
  | { ok: false; error: string; status: 401 | 403 }
  | { ok: true; sandboxId: string };

async function getSeekerSandboxId(): Promise<SeekerAuth> {
  const user = await getCurrentLocalUser();
  if (!user) return { ok: false, error: "Log in required", status: 401 };
  if (user.role !== "SEEKER") return { ok: false, error: "Job seeker account required", status: 403 };
  return { ok: true, sandboxId: sandboxIdForUser(user.id) };
}

function authError(auth: { error: string; status: 401 | 403 }) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
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

export async function GET() {
  const auth = await getSeekerSandboxId();
  if (!auth.ok) return authError(auth);
  return NextResponse.json(await getSandboxSnapshot(auth.sandboxId));
}

export async function PATCH(request: Request) {
  const auth = await getSeekerSandboxId();
  if (!auth.ok) return authError(auth);

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
    await saveSandboxDraft(
      sections,
      typeof body.targetRole === "string" ? body.targetRole : "",
      typeof body.title === "string" ? body.title : undefined,
      isResumeSectionId(body.sectionId) ? body.sectionId : undefined,
      auth.sandboxId,
      typeof body.namedVersionId === "string" ? body.namedVersionId : undefined,
    ),
  );
}

export async function DELETE() {
  const auth = await getSeekerSandboxId();
  if (!auth.ok) return authError(auth);
  return NextResponse.json(await resetSandbox(auth.sandboxId));
}
