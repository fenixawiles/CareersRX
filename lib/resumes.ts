import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  ApplicationPacketView,
  ResumeDocumentView,
  ResumeProposalView,
  ResumeSectionView,
  ResumeVersionView,
  ResumeWorkspaceView,
} from "@/lib/resume-types";
import type { Prisma, $Enums } from "@/app/generated/prisma/client";

type ProposalDecision = "ACCEPTED" | "REJECTED";

function toIso(date: Date) {
  return date.toISOString();
}

function toVersionView(version: {
  id: string;
  versionNumber: number;
  sourceType: string;
  aiGenerated: boolean;
  createdAt: Date;
}): ResumeVersionView {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    sourceType: version.sourceType,
    aiGenerated: version.aiGenerated,
    createdAt: toIso(version.createdAt),
  };
}

function toSectionView(section: {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  syncStatus: string;
  linkedEntityType: string | null;
  updatedAt: Date;
}): ResumeSectionView {
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    content: section.content,
    order: section.order,
    syncStatus: section.syncStatus,
    linkedEntityType: section.linkedEntityType,
    updatedAt: toIso(section.updatedAt),
  };
}

function toProposalView(proposal: {
  id: string;
  target: string;
  scope: string | null;
  status: string;
  title: string;
  summary: string;
  reason: string | null;
  confidence: number | null;
  createdAt: Date;
}): ResumeProposalView {
  return {
    id: proposal.id,
    target: proposal.target,
    scope: proposal.scope,
    status: proposal.status,
    title: proposal.title,
    summary: proposal.summary,
    reason: proposal.reason,
    confidence: proposal.confidence,
    createdAt: toIso(proposal.createdAt),
  };
}

function toDocumentView(document: {
  id: string;
  title: string;
  targetRole: string | null;
  status: string;
  variantLabel: string | null;
  updatedAt: Date;
  activeVersion?: {
    id: string;
    versionNumber: number;
    sourceType: string;
    aiGenerated: boolean;
    createdAt: Date;
  } | null;
  _count?: {
    syncProposals?: number;
    sections?: number;
  };
}): ResumeDocumentView {
  return {
    id: document.id,
    title: document.title,
    targetRole: document.targetRole,
    status: document.status,
    variantLabel: document.variantLabel,
    updatedAt: toIso(document.updatedAt),
    activeVersion: document.activeVersion ? toVersionView(document.activeVersion) : null,
    pendingProposalCount: document._count?.syncProposals ?? 0,
    sectionCount: document._count?.sections ?? 0,
  };
}

function plainTextFromSections(sections: { title: string; content: string }[]) {
  return sections.map((section) => `${section.title}\n${section.content}`).join("\n\n");
}

function htmlFromSections(sections: { title: string; content: string }[]) {
  return sections
    .map(
      (section) =>
        `<section><h2>${section.title}</h2><p>${section.content.replaceAll("\n", "<br />")}</p></section>`,
    )
    .join("");
}

function contentJsonFromSections(
  sections: { id?: string; type: string; title: string; content: string; order: number; syncStatus: string }[],
): Prisma.InputJsonObject {
  return {
    schemaVersion: "resume-v1",
    sections: sections.map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      content: section.content,
      order: section.order,
      syncStatus: section.syncStatus,
    })),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function appendUnique(existing: string[], additions: string[]) {
  return Array.from(new Set([...existing, ...additions].filter(Boolean)));
}

function credentialSummaryName(name: string) {
  if (/certified nursing assistant/i.test(name)) return "CNA";
  if (/basic life support/i.test(name)) return "BLS";
  if (/cardiopulmonary resuscitation/i.test(name)) return "CPR";
  return name;
}

export async function deriveProfileSummaryFields(seekerId: string) {
  const [profile, credentials, workHistory] = await Promise.all([
    prisma.seekerProfile.findUniqueOrThrow({ where: { id: seekerId } }),
    prisma.careerCredential.findMany({
      where: { seekerId, status: { in: ["ACTIVE", "REVIEW_REQUIRED"] } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.workHistoryEntry.findMany({ where: { seekerId } }),
  ]);

  const licenses = credentials
    .filter((credential) => credential.kind === "LICENSE" && credential.status === "ACTIVE")
    .map((credential) => credentialSummaryName(credential.name));
  const certifications = credentials
    .filter((credential) => credential.kind === "CERTIFICATION" && credential.status === "ACTIVE")
    .map((credential) => credentialSummaryName(credential.name));
  const derivedSkills = workHistory.flatMap((entry) => entry.skills);

  return prisma.seekerProfile.update({
    where: { id: seekerId },
    data: {
      licenses: appendUnique(profile.licenses, licenses),
      certifications: appendUnique(profile.certifications, certifications),
      skills: appendUnique(profile.skills, derivedSkills),
    },
  });
}

export async function getResumeLibrary(seekerId: string) {
  const documents = await prisma.resumeDocument.findMany({
    where: { seekerId, archivedAt: null },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      activeVersion: true,
      _count: {
        select: {
          sections: true,
          syncProposals: { where: { status: "PENDING" } },
        },
      },
    },
  });

  return documents.map(toDocumentView);
}

export async function getResumeWorkspace(seekerId: string, documentId: string): Promise<ResumeWorkspaceView | null> {
  const document = await prisma.resumeDocument.findFirst({
    where: { id: documentId, seekerId },
    include: {
      activeVersion: true,
      sections: { orderBy: { order: "asc" } },
      versions: { orderBy: { versionNumber: "desc" } },
      syncProposals: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
      seeker: true,
      _count: {
        select: {
          sections: true,
          syncProposals: { where: { status: "PENDING" } },
        },
      },
    },
  });

  if (!document) return null;

  return {
    document: toDocumentView(document),
    sections: document.sections.map(toSectionView),
    versions: document.versions.map(toVersionView),
    proposals: document.syncProposals.map(toProposalView),
    profile: {
      name: `${document.seeker.firstName} ${document.seeker.lastName}`,
      skills: document.seeker.skills,
      licenses: document.seeker.licenses,
      certifications: document.seeker.certifications,
      preferredCategories: document.seeker.preferredCategories,
    },
  };
}

export async function getResumeVersions(seekerId: string, documentId: string) {
  const document = await prisma.resumeDocument.findFirst({
    where: { id: documentId, seekerId },
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
      sections: { orderBy: { order: "asc" } },
      activeVersion: true,
      _count: { select: { sections: true, syncProposals: { where: { status: "PENDING" } } } },
    },
  });
  if (!document) return null;
  return {
    document: toDocumentView(document),
    versions: document.versions.map(toVersionView),
  };
}

export async function createResumeVersionFromSections({
  seekerId,
  documentId,
  sourceType,
  createdById,
  aiGenerated = false,
}: {
  seekerId: string;
  documentId: string;
  sourceType: string;
  createdById?: string;
  aiGenerated?: boolean;
}) {
  const document = await prisma.resumeDocument.findFirstOrThrow({
    where: { id: documentId, seekerId },
    include: {
      sections: { orderBy: { order: "asc" } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  const nextVersion = (document.versions[0]?.versionNumber ?? 0) + 1;
  const sectionSnapshots = document.sections.map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    content: section.content,
    order: section.order,
    syncStatus: section.syncStatus,
  }));
  const version = await prisma.resumeVersion.create({
    data: {
      documentId,
      versionNumber: nextVersion,
      contentJson: contentJsonFromSections(sectionSnapshots),
      renderedText: plainTextFromSections(sectionSnapshots),
      renderedHtml: htmlFromSections(sectionSnapshots),
      sourceType,
      aiGenerated,
      createdById,
    },
  });

  await prisma.resumeDocument.update({
    where: { id: documentId },
    data: { activeVersionId: version.id, status: "ACTIVE" },
  });

  await prisma.careerSyncAuditLog.create({
    data: {
      seekerId,
      actorId: createdById,
      action: "RESUME_VERSION_CREATED",
      source: sourceType,
      target: "ResumeVersion",
      entityId: version.id,
      afterValue: { documentId, versionNumber: nextVersion },
    },
  });

  return version;
}

export async function saveResumeSectionEdit({
  seekerId,
  sectionId,
  content,
  actorId,
}: {
  seekerId: string;
  sectionId: string;
  content: string;
  actorId?: string;
}) {
  const section = await prisma.resumeSection.findFirstOrThrow({
    where: { id: sectionId, document: { seekerId } },
    include: { document: true },
  });
  const previousContent = section.content;

  await prisma.resumeSection.update({
    where: { id: sectionId },
    data: { content, syncStatus: "NEEDS_REVIEW" },
  });

  const version = await createResumeVersionFromSections({
    seekerId,
    documentId: section.documentId,
    sourceType: "manual_section_edit",
    createdById: actorId,
  });

  await prisma.careerSyncAuditLog.create({
    data: {
      seekerId,
      actorId,
      action: "RESUME_VERSION_CREATED",
      source: "manual_section_edit",
      target: "ResumeSection",
      entityId: sectionId,
      beforeValue: { content: previousContent },
      afterValue: { content, versionId: version.id },
    },
  });

  return version;
}

export async function createResumeFromProfile(seekerId: string, actorId?: string) {
  const seeker = await prisma.seekerProfile.findUniqueOrThrow({ where: { id: seekerId } });
  const sections = [
    {
      type: "SUMMARY",
      title: "Professional Summary",
      content: seeker.bio ?? `${seeker.firstName} ${seeker.lastName}'s professional summary.`,
      order: 0,
      syncStatus: "SYNCED",
      linkedEntityType: "SeekerProfile",
    },
    {
      type: "LICENSES",
      title: "Licenses & Certifications",
      content: [...seeker.licenses, ...seeker.certifications].join("\n") || "Add licenses and certifications.",
      order: 1,
      syncStatus: "SYNCED",
      linkedEntityType: "CareerCredential",
    },
    {
      type: "SKILLS",
      title: "Skills",
      content: seeker.skills.join(" · ") || "Add skills.",
      order: 2,
      syncStatus: "SYNCED",
      linkedEntityType: "SeekerProfile.skills",
    },
  ] as const;

  const document = await prisma.resumeDocument.create({
    data: {
      seekerId,
      title: `${seeker.firstName} ${seeker.lastName} — Live Résumé`,
      targetRole: seeker.preferredCategories[0] ?? null,
      status: "ACTIVE",
      variantLabel: "Primary",
      sections: {
        create: sections.map((section) => ({
          type: section.type,
          title: section.title,
          content: section.content,
          order: section.order,
          syncStatus: section.syncStatus,
          linkedEntityType: section.linkedEntityType,
        })),
      },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  const version = await prisma.resumeVersion.create({
    data: {
      documentId: document.id,
      versionNumber: 1,
      contentJson: contentJsonFromSections(document.sections),
      renderedText: plainTextFromSections(document.sections),
      renderedHtml: htmlFromSections(document.sections),
      sourceType: "profile_template",
      createdById: actorId,
    },
  });

  await prisma.resumeDocument.update({
    where: { id: document.id },
    data: { activeVersionId: version.id },
  });

  return document;
}

export async function createResumeVariant({
  seekerId,
  documentId,
  targetRole,
  title,
  actorId,
}: {
  seekerId: string;
  documentId: string;
  targetRole: string;
  title?: string;
  actorId?: string;
}) {
  const source = await prisma.resumeDocument.findFirstOrThrow({
    where: { id: documentId, seekerId },
    include: { sections: { orderBy: { order: "asc" } }, activeVersion: true },
  });

  const variant = await prisma.resumeDocument.create({
    data: {
      seekerId,
      title: title || `${source.title} — ${targetRole} Variant`,
      targetRole,
      status: "DRAFT",
      variantLabel: targetRole,
      baseDocumentId: source.id,
      sections: {
        create: source.sections.map((section) => ({
          type: section.type,
          title: section.title,
          content: section.content,
          order: section.order,
          linkedEntityType: section.linkedEntityType,
          linkedEntityId: section.linkedEntityId,
          syncStatus: "APPLICATION_SPECIFIC",
        })),
      },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  const version = await prisma.resumeVersion.create({
    data: {
      documentId: variant.id,
      versionNumber: 1,
      contentJson: contentJsonFromSections(variant.sections),
      renderedText: plainTextFromSections(variant.sections),
      renderedHtml: htmlFromSections(variant.sections),
      sourceType: "manual_variant",
      createdById: actorId,
    },
  });

  await prisma.resumeDocument.update({
    where: { id: variant.id },
    data: { activeVersionId: version.id },
  });

  await prisma.careerSyncAuditLog.create({
    data: {
      seekerId,
      actorId,
      action: "RESUME_VARIANT_CREATED",
      source: "manual_variant",
      target: "ResumeDocument",
      entityId: variant.id,
      afterValue: { baseDocumentId: source.id, targetRole },
    },
  });

  return variant;
}

export async function applyProposalDecision({
  seekerId,
  proposalId,
  decision,
  scope,
  actorId,
}: {
  seekerId: string;
  proposalId: string;
  decision: ProposalDecision;
  scope?: string;
  actorId?: string;
}) {
  const proposal = await prisma.resumeSyncProposal.findFirstOrThrow({
    where: { id: proposalId, seekerId },
  });

  if (decision === "REJECTED") {
    await prisma.resumeSyncProposal.update({
      where: { id: proposal.id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    await prisma.careerSyncAuditLog.create({
      data: {
        seekerId,
        actorId,
        action: "PROPOSAL_REJECTED",
        source: "proposal_decision",
        target: proposal.target,
        entityId: proposal.id,
        beforeValue: proposal.beforeValue ?? undefined,
        afterValue: { status: "REJECTED" },
      },
    });
    return { status: "REJECTED" as const };
  }

  const selectedScope = scope ?? proposal.scope ?? "RESUME_ONLY";
  const proposedValue = asObject(proposal.proposedValue);

  if (selectedScope === "PROFILE_UPDATE") {
    if (proposal.target === "LICENSES" || proposal.target === "CERTIFICATIONS") {
      const credential = asObject(proposedValue.credential);
      const name = typeof credential.name === "string" ? credential.name : proposal.title;
      const kind =
        proposal.target === "CERTIFICATIONS" || credential.kind === "CERTIFICATION"
          ? "CERTIFICATION"
          : "LICENSE";
      const state = typeof credential.state === "string" ? credential.state : undefined;
      const status =
        credential.status === "REVIEW_REQUIRED" ||
        credential.status === "PENDING" ||
        credential.status === "EXPIRED"
          ? credential.status
          : "ACTIVE";

      const existing = await prisma.careerCredential.findFirst({
        where: { seekerId, name, state: state ?? null, kind },
      });
      if (existing) {
        await prisma.careerCredential.update({
          where: { id: existing.id },
          data: { status, sourceProposalId: proposal.id },
        });
      } else {
        await prisma.careerCredential.create({
          data: {
            seekerId,
            kind,
            name,
            state,
            status,
            issuer: typeof credential.issuer === "string" ? credential.issuer : undefined,
            licenseNumber:
              typeof credential.licenseNumber === "string" ? credential.licenseNumber : undefined,
            sourceProposalId: proposal.id,
          },
        });
      }
      await deriveProfileSummaryFields(seekerId);
    }

    if (proposal.target === "SKILLS" || proposal.target === "PROFILE") {
      const profile = await prisma.seekerProfile.findUniqueOrThrow({ where: { id: seekerId } });
      const skills = asStringArray(proposedValue.skills);
      const hasGranularSkillReview =
        Array.isArray(proposedValue.addedSkills) || Array.isArray(proposedValue.removedSkills);
      if (hasGranularSkillReview) {
        await prisma.seekerProfile.update({
          where: { id: seekerId },
          data: { skills },
        });
      } else if (skills.length > 0) {
        await prisma.seekerProfile.update({
          where: { id: seekerId },
          data: { skills: appendUnique(profile.skills, skills) },
        });
      }
    }
  }

  if (selectedScope === "PREFERENCES_UPDATE") {
    const profile = await prisma.seekerProfile.findUniqueOrThrow({ where: { id: seekerId } });
    const preferredCategories = asStringArray(proposedValue.preferredCategories);
    const preferredStates = asStringArray(proposedValue.preferredStates);
    await prisma.seekerProfile.update({
      where: { id: seekerId },
      data: {
        preferredCategories: appendUnique(profile.preferredCategories, preferredCategories),
        preferredStates: appendUnique(profile.preferredStates, preferredStates),
      },
    });
  }

  if (selectedScope === "CREATE_VARIANT") {
    await createResumeVariant({
      seekerId,
      documentId: proposal.documentId,
      targetRole: typeof proposedValue.targetRole === "string" ? proposedValue.targetRole : proposal.title,
      title: typeof proposedValue.title === "string" ? proposedValue.title : undefined,
      actorId,
    });
  }

  if (selectedScope === "APPLICATION_PACKET" && typeof proposedValue.jobId === "string") {
    await createApplicationPacketForJob({
      seekerId,
      jobId: proposedValue.jobId,
      resumeDocumentId: proposal.documentId,
    });
  }

  await prisma.resumeSyncProposal.update({
    where: { id: proposal.id },
    data: {
      status: selectedScope === "RESUME_ONLY" ? "ACCEPTED" : "APPLIED",
      scope: selectedScope as $Enums.ResumeSyncScope,
      decidedAt: new Date(),
      appliedAt: selectedScope === "RESUME_ONLY" ? null : new Date(),
    },
  });

  await prisma.careerSyncAuditLog.create({
    data: {
      seekerId,
      actorId,
      action: selectedScope === "PREFERENCES_UPDATE" ? "PREFERENCES_UPDATED" : "PROPOSAL_ACCEPTED",
      source: "proposal_decision",
      target: proposal.target,
      entityId: proposal.id,
      beforeValue: proposal.beforeValue ?? undefined,
      afterValue: { status: "APPLIED", scope: selectedScope, proposedValue } as Prisma.InputJsonValue,
    },
  });

  return { status: "APPLIED" as const };
}

export async function getApplicationPackets(seekerId: string): Promise<ApplicationPacketView[]> {
  const packets = await prisma.applicationPacket.findMany({
    where: { seekerId },
    orderBy: { updatedAt: "desc" },
    include: {
      job: { include: { company: { select: { name: true } } } },
      resumeDocument: { select: { id: true, title: true } },
      resumeVersion: { select: { id: true, versionNumber: true } },
    },
  });
  return packets.map(toPacketView);
}

export async function getApplicationPacket(seekerId: string, packetId: string) {
  const packet = await prisma.applicationPacket.findFirst({
    where: { id: packetId, seekerId },
    include: {
      job: { include: { company: { select: { name: true } } } },
      resumeDocument: { select: { id: true, title: true } },
      resumeVersion: { select: { id: true, versionNumber: true, renderedText: true } },
    },
  });
  return packet ? toPacketView(packet) : null;
}

function toPacketView(packet: {
  id: string;
  title: string;
  status: string;
  fitSummary: string | null;
  missingRequirements: Prisma.JsonValue | null;
  supportedMatches: Prisma.JsonValue | null;
  updatedAt: Date;
  job: {
    title: string;
    city: string;
    state: string;
    company: { name: string };
  } | null;
  resumeDocument: { id: string; title: string } | null;
  resumeVersion: { id: string; versionNumber: number } | null;
}): ApplicationPacketView {
  return {
    id: packet.id,
    title: packet.title,
    status: packet.status,
    fitSummary: packet.fitSummary,
    missingRequirements: packet.missingRequirements,
    supportedMatches: packet.supportedMatches,
    updatedAt: toIso(packet.updatedAt),
    job: packet.job
      ? {
          title: packet.job.title,
          companyName: packet.job.company.name,
          city: packet.job.city,
          state: packet.job.state,
        }
      : null,
    resumeDocument: packet.resumeDocument,
    resumeVersion: packet.resumeVersion,
  };
}

export async function createApplicationPacketForJob({
  seekerId,
  jobId,
  resumeDocumentId,
}: {
  seekerId: string;
  jobId: string;
  resumeDocumentId?: string;
}) {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { company: { select: { name: true } } },
  });
  const document =
    (resumeDocumentId
      ? await prisma.resumeDocument.findFirst({
          where: { id: resumeDocumentId, seekerId },
          include: { activeVersion: true },
        })
      : await prisma.resumeDocument.findFirst({
          where: { seekerId, status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          include: { activeVersion: true },
        })) ?? (await createResumeFromProfile(seekerId));

  const documentWithVersion = await prisma.resumeDocument.findFirstOrThrow({
    where: { id: document.id, seekerId },
    include: { activeVersion: true },
  });

  return prisma.applicationPacket.create({
    data: {
      seekerId,
      jobId: job.id,
      resumeDocumentId: documentWithVersion.id,
      resumeVersionId: documentWithVersion.activeVersionId,
      status: "DRAFT",
      title: `${job.title} packet`,
      snapshotMetadata: {
        jobTitle: job.title,
        companyName: job.company.name,
        resumeDocumentId: documentWithVersion.id,
        resumeVersionId: documentWithVersion.activeVersionId,
      },
    },
  });
}
