import { NextResponse } from "next/server";
import { resumeImportApplyModeSchema } from "@/lib/ai/schemas";
import { applySandboxResumeImport } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { applyMode?: unknown } | null;
  const parsedMode = resumeImportApplyModeSchema.safeParse(body?.applyMode);
  if (!parsedMode.success || parsedMode.data === "fill_signup_fields") {
    return NextResponse.json({ error: "Unsupported résumé import apply mode." }, { status: 400 });
  }

  const result = applySandboxResumeImport(id, parsedMode.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.snapshot);
}
