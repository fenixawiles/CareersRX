import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { compareJobFit } from "@/lib/ai/openai";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const { id } = await context.params;
  const packet = await prisma.applicationPacket.findFirst({
    where: { id, seekerId: seeker.id },
    include: {
      job: true,
      resumeVersion: true,
      seeker: true,
    },
  });
  if (!packet) return NextResponse.json({ error: "Application packet not found" }, { status: 404 });
  if (!packet.job) return NextResponse.json({ error: "Application packet has no job" }, { status: 400 });

  try {
    const ai = await compareJobFit({
      job: {
        title: packet.job.title,
        category: packet.job.category,
        requirements: packet.job.requirements,
        requiredLicenses: packet.job.requiredLicenses,
        requiredCertifications: packet.job.requiredCertifications,
        requiredYearsExp: packet.job.requiredYearsExp,
        city: packet.job.city,
        state: packet.job.state,
      },
      profile: {
        skills: packet.seeker.skills,
        licenses: packet.seeker.licenses,
        certifications: packet.seeker.certifications,
        preferredCategories: packet.seeker.preferredCategories,
        preferredStates: packet.seeker.preferredStates,
      },
      resumeText: packet.resumeVersion?.renderedText ?? "",
    });

    const interaction = await prisma.aiInteraction.create({
      data: {
        seekerId: seeker.id,
        task: "COMPARE_JOB_FIT",
        model: ai.model,
        fallbackModel: ai.fallbackModel,
        status: "SUCCEEDED",
        inputMetadata: {
          packetId: packet.id,
          jobId: packet.jobId,
          resumeVersionId: packet.resumeVersionId,
          demoMode: ai.demoMode,
          usedFallback: ai.usedFallback,
        },
        parsedOutput: ai.output,
        rawResponseId: ai.rawResponseId,
        inputTokens: ai.inputTokens,
        outputTokens: ai.outputTokens,
        completedAt: new Date(),
      },
    });

    const updatedPacket = await prisma.applicationPacket.update({
      where: { id: packet.id },
      data: {
        status: ai.output.recommendation === "READY" ? "READY" : "DRAFT",
        fitSummary: ai.output.fitSummary,
        supportedMatches: ai.output.supportedMatches,
        missingRequirements: ai.output.missingRequirements,
        snapshotMetadata: {
          interactionId: interaction.id,
          recommendation: ai.output.recommendation,
          unsupportedClaims: ai.output.unsupportedClaims,
        },
      },
    });

    await prisma.careerSyncAuditLog.create({
      data: {
        seekerId: seeker.id,
        actorId: seeker.userId,
        action: "AI_REQUESTED",
        source: ai.demoMode ? "demo-rules" : "openai_responses",
        target: "ApplicationPacket",
        entityId: packet.id,
        afterValue: {
          recommendation: ai.output.recommendation,
          missingRequirements: ai.output.missingRequirements,
        },
      },
    });

    return NextResponse.json({ packet: updatedPacket, comparison: ai.output, demoMode: ai.demoMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job-fit comparison failed";
    await prisma.aiInteraction.create({
      data: {
        seekerId: seeker.id,
        task: "COMPARE_JOB_FIT",
        model: process.env.OPENAI_MODEL ?? "gpt-5.4",
        fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? "gpt-5.2",
        status: "FAILED",
        inputMetadata: { packetId: packet.id, jobId: packet.jobId },
        error: message,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
