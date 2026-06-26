import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { detectResumeChanges } from "@/lib/ai/openai";
import type { Prisma } from "@/app/generated/prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function textFromSections(sections: { title: string; content: string }[]) {
  return sections.map((section) => `${section.title}\n${section.content}`).join("\n\n");
}

export async function POST(_request: Request, context: RouteContext) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const { id } = await context.params;
  const document = await prisma.resumeDocument.findFirst({
    where: { id, seekerId: seeker.id },
    include: {
      activeVersion: true,
      sections: { orderBy: { order: "asc" } },
      versions: { orderBy: { versionNumber: "desc" }, take: 2 },
      seeker: true,
    },
  });
  if (!document) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  const currentVersionText = document.activeVersion?.renderedText ?? textFromSections(document.sections);
  const previousVersion =
    document.versions.find((version) => version.id !== document.activeVersionId) ?? document.versions[1];

  try {
    const ai = await detectResumeChanges({
      documentTitle: document.title,
      previousVersionText: previousVersion?.renderedText,
      currentVersionText,
      profile: {
        skills: document.seeker.skills,
        licenses: document.seeker.licenses,
        certifications: document.seeker.certifications,
        preferredCategories: document.seeker.preferredCategories,
        preferredStates: document.seeker.preferredStates,
      },
    });

    const interaction = await prisma.aiInteraction.create({
      data: {
        seekerId: seeker.id,
        task: "DETECT_RESUME_CHANGES",
        model: ai.model,
        fallbackModel: ai.fallbackModel,
        status: "SUCCEEDED",
        inputMetadata: {
          documentId: document.id,
          activeVersionId: document.activeVersionId,
          previousVersionId: previousVersion?.id,
          demoMode: ai.demoMode,
          usedFallback: ai.usedFallback,
        },
        parsedOutput: ai.output as Prisma.InputJsonValue,
        rawResponseId: ai.rawResponseId,
        inputTokens: ai.inputTokens,
        outputTokens: ai.outputTokens,
        completedAt: new Date(),
      },
    });

    const proposals = await Promise.all(
      ai.output.proposals.map((proposal) =>
        prisma.resumeSyncProposal.create({
          data: {
            seekerId: seeker.id,
            documentId: document.id,
            versionId: document.activeVersionId,
            aiInteractionId: interaction.id,
            target: proposal.target,
            scope: proposal.scope,
            title: proposal.title,
            summary: proposal.summary,
            reason: proposal.reason,
            confidence: proposal.confidence,
            proposedValue: proposal.proposedValue as Prisma.InputJsonValue,
            beforeValue: proposal.beforeValue as Prisma.InputJsonValue | undefined,
          },
        }),
      ),
    );

    await prisma.careerSyncAuditLog.create({
      data: {
        seekerId: seeker.id,
        actorId: seeker.userId,
        action: "AI_REQUESTED",
        source: ai.demoMode ? "demo-rules" : "openai_responses",
        target: "ResumeSyncProposal",
        entityId: document.id,
        afterValue: {
          proposalCount: proposals.length,
          unsupportedClaims: ai.output.unsupportedClaims,
          safetyNotes: ai.output.safetyNotes,
        },
      },
    });

    return NextResponse.json({
      proposals,
      unsupportedClaims: ai.output.unsupportedClaims,
      safetyNotes: ai.output.safetyNotes,
      demoMode: ai.demoMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed";
    await prisma.aiInteraction.create({
      data: {
        seekerId: seeker.id,
        task: "DETECT_RESUME_CHANGES",
        model: process.env.OPENAI_MODEL ?? "gpt-5.4",
        fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? "gpt-5.2",
        status: "FAILED",
        inputMetadata: { documentId: document.id, activeVersionId: document.activeVersionId },
        error: message,
        completedAt: new Date(),
      },
    });

    await prisma.careerSyncAuditLog.create({
      data: {
        seekerId: seeker.id,
        actorId: seeker.userId,
        action: "AI_FAILED",
        source: "openai_responses",
        target: "ResumeSyncProposal",
        entityId: document.id,
        afterValue: { error: message },
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
