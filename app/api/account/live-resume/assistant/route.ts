import { NextResponse } from "next/server";
import {
  rexAssistantRequestSchema,
} from "@/lib/ai/schemas";
import { answerRexAssistant } from "@/lib/ai/openai";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { getSandboxSnapshot, writeSandboxAiInteraction } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });

  const parsedRequest = rexAssistantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "Unsupported or invalid Rex request" }, { status: 400 });
  }

  const sandboxId = sandboxIdForUser(user.id);
  const snapshot = getSandboxSnapshot(sandboxId);
  const body = parsedRequest.data;
  const sectionId =
    body.task === "review_summary"
      ? "summary"
      : body.sectionId && snapshot.resume.sections.some((section) => section.id === body.sectionId)
        ? body.sectionId
        : undefined;

  try {
    const ai = await answerRexAssistant({
      task: body.task,
      sectionId,
      jobTitle: body.jobTitle,
      navigationTarget: body.navigationTarget,
      message: body.message,
      chatHistory: body.chatHistory,
      mode: "account",
      profile: snapshot.profile,
      resume: snapshot.resume,
      namedVersions: snapshot.namedVersions,
      revisions: snapshot.revisions,
    });

    const interactionId = writeSandboxAiInteraction({
      sandboxId,
      task: `REX_${body.task.toUpperCase()}`,
      model: ai.model,
      fallbackModel: ai.fallbackModel,
      status: "SUCCEEDED",
      inputMetadata: {
        userId: user.id,
        task: body.task,
        sectionId,
        navigationTarget: body.navigationTarget,
        messageLength: body.message?.length ?? 0,
        chatHistoryCount: body.chatHistory?.length ?? 0,
        demoMode: ai.demoMode,
        usedFallback: ai.usedFallback,
      },
      parsedOutput: ai.output,
      rawResponseId: ai.rawResponseId,
      inputTokens: ai.inputTokens,
      outputTokens: ai.outputTokens,
    });

    return NextResponse.json({ ...ai.output, demoMode: ai.demoMode, interactionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rex assistant request failed";
    writeSandboxAiInteraction({
      sandboxId,
      task: `REX_${body.task.toUpperCase()}`,
      model: process.env.OPENAI_MODEL ?? "gpt-5.4",
      fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? "gpt-5.2",
      status: "FAILED",
      inputMetadata: { userId: user.id, task: body.task, sectionId },
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
