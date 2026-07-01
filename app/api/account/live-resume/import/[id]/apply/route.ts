import { NextResponse } from "next/server";
import { resumeImportApplyModeSchema } from "@/lib/ai/schemas";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { applySandboxResumeImport } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { applyMode?: unknown } | null;
  const parsedMode = resumeImportApplyModeSchema.safeParse(body?.applyMode);
  if (!parsedMode.success || parsedMode.data === "fill_signup_fields") {
    return NextResponse.json({ error: "Unsupported résumé import apply mode." }, { status: 400 });
  }

  const result = applySandboxResumeImport(id, parsedMode.data, sandboxIdForUser(user.id));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.snapshot);
}
