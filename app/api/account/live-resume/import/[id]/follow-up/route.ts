import { NextResponse } from "next/server";
import { answerResumeImportFollowupWithRex } from "@/lib/ai/openai";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { getSandboxResumeImport, getSandboxSnapshot, writeSandboxAiInteraction } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  if (typeof body?.message !== "string" || !body.message.trim() || body.message.length > 500) {
    return NextResponse.json({ error: "Import follow-up messages are limited to 500 characters." }, { status: 400 });
  }
  const sandboxId = sandboxIdForUser(user.id);
  const resumeImport = getSandboxResumeImport(id, sandboxId);
  if (!resumeImport) return NextResponse.json({ error: "Resume import not found." }, { status: 404 });

  const snapshot = getSandboxSnapshot(sandboxId);
  const ai = await answerResumeImportFollowupWithRex({
    message: body.message.trim(),
    resumeImport,
    profile: snapshot.profile,
    resume: snapshot.resume,
    mode: "account",
  });
  writeSandboxAiInteraction({
    sandboxId,
    task: "REX_RESUME_IMPORT_FOLLOWUP",
    model: ai.model,
    fallbackModel: ai.fallbackModel,
    status: "SUCCEEDED",
    inputMetadata: {
      importId: resumeImport.id,
      fileName: resumeImport.fileName,
      messageLength: body.message.trim().length,
      usedFallback: ai.usedFallback,
      demoMode: ai.demoMode,
    },
    parsedOutput: ai.output,
    rawResponseId: ai.rawResponseId,
    inputTokens: ai.inputTokens,
    outputTokens: ai.outputTokens,
  });

  return NextResponse.json({ ...ai.output, demoMode: ai.demoMode });
}
