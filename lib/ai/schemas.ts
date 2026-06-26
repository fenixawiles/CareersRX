import { z } from "zod";

export const resumeSyncTargetSchema = z.enum([
  "PROFILE",
  "PREFERENCES",
  "SKILLS",
  "LICENSES",
  "CERTIFICATIONS",
  "WORK_HISTORY",
  "EDUCATION",
  "RESUME_VARIANT",
  "APPLICATION_PACKET",
]);

export const resumeSyncScopeSchema = z.enum([
  "RESUME_ONLY",
  "PROFILE_UPDATE",
  "PREFERENCES_UPDATE",
  "CREATE_VARIANT",
  "APPLICATION_PACKET",
]);

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const resumeSyncProposalDraftSchema = z.object({
  target: resumeSyncTargetSchema,
  scope: resumeSyncScopeSchema,
  title: z.string().min(4).max(160),
  summary: z.string().min(10).max(1200),
  reason: z.string().max(1200).optional(),
  confidence: z.number().int().min(0).max(100),
  proposedValue: jsonRecordSchema,
  beforeValue: jsonRecordSchema.optional(),
});

export const resumeChangeDetectionSchema = z.object({
  proposals: z.array(resumeSyncProposalDraftSchema).max(8),
  unsupportedClaims: z.array(z.string()).max(12).default([]),
  safetyNotes: z.array(z.string()).max(8).default([]),
});

export const jobFitComparisonSchema = z.object({
  fitSummary: z.string().min(10).max(1500),
  supportedMatches: z
    .array(
      z.object({
        kind: z.enum(["license", "certification", "skill", "experience", "preference"]),
        label: z.string().min(1).max(160),
        evidence: z.string().min(1).max(400),
      }),
    )
    .max(20),
  missingRequirements: z
    .array(
      z.object({
        kind: z.enum(["license", "certification", "skill", "experience", "location", "other"]),
        label: z.string().min(1).max(160),
        reason: z.string().min(1).max(500),
      }),
    )
    .max(20),
  unsupportedClaims: z.array(z.string()).max(12).default([]),
  recommendation: z.enum(["READY", "NEEDS_REVIEW", "NOT_READY"]),
});

export const rexAssistantTaskSchema = z.enum([
  "review_summary",
  "review_section",
  "resume_hygiene",
  "suggest_skills_for_role",
  "custom_chat",
  "profile_sync_help",
  "site_navigation",
  "privacy_data",
]);

export const rexNavigationTargetSchema = z.enum([
  "profile",
  "live_resume",
  "applications",
  "saved_jobs",
  "account",
  "privacy",
  "terms",
  "safety",
  "contact",
]);

export const rexResumeSectionIdSchema = z.enum([
  "summary",
  "experience",
  "credentials",
  "skills",
  "preferences",
]);

export const resumeImportIntentSchema = z.enum([
  "new_version",
  "replace_current",
  "signup_onboarding",
]);

export const resumeImportApplyModeSchema = z.enum([
  "create_version",
  "replace_current",
  "fill_signup_fields",
]);

export const rexChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(800),
});

export const rexAssistantRequestSchema = z
  .object({
    task: rexAssistantTaskSchema,
    sectionId: rexResumeSectionIdSchema.optional(),
    jobTitle: z.string().max(120).optional(),
    navigationTarget: rexNavigationTargetSchema.optional(),
    message: z.string().max(800).optional(),
    chatHistory: z.array(rexChatTurnSchema).max(6).optional(),
  })
  .superRefine((value, context) => {
    if (value.task === "custom_chat" && !value.message?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["message"],
        message: "Message is required for Rex chat.",
      });
    }
  });

export const rexSuggestionCardSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(700),
  targetSectionId: rexResumeSectionIdSchema.nullable(),
  patch: z.string().max(4000).nullable(),
  actionLabel: z.string().min(1).max(80),
});

export const rexAssistantResponseSchema = z.object({
  assistantName: z.literal("Rex"),
  answer: z.string().min(1).max(1800),
  suggestions: z.array(z.string().min(1).max(300)).max(8),
  sectionPatch: z.string().max(4000).nullable(),
  sectionId: z.string().max(80).nullable(),
  suggestionCards: z.array(rexSuggestionCardSchema).max(6),
  link: z
    .object({
      label: z.string().min(1).max(120),
      href: z.string().min(1).max(240),
    })
    .nullable(),
  safetyNotes: z.array(z.string().min(1).max(300)).max(6),
});

export const resumeImportPlacementSchema = z.object({
  sectionId: rexResumeSectionIdSchema,
  title: z.string().min(1).max(140),
  content: z.string().max(16000),
  sourceEvidence: z.string().max(1200),
  confidence: z.number().int().min(0).max(100),
  notes: z.array(z.string().min(1).max(240)).max(4),
});

export const resumeImportParseSchema = z.object({
  assistantName: z.literal("Rex"),
  answer: z.string().min(1).max(1800),
  resumeTitle: z.string().min(1).max(160),
  targetRole: z.string().max(160),
  placements: z.array(resumeImportPlacementSchema).max(5),
  suggestions: z.array(z.string().min(1).max(300)).max(8),
  ambiguousItems: z.array(z.string().min(1).max(400)).max(8),
  unsupportedItems: z.array(z.string().min(1).max(400)).max(8),
  confidence: z.number().int().min(0).max(100),
  safetyNotes: z.array(z.string().min(1).max(300)).max(6),
});

export const resumeImportFollowupSchema = z.object({
  assistantName: z.literal("Rex"),
  answer: z.string().min(1).max(1400),
  suggestions: z.array(z.string().min(1).max(260)).max(5),
  safetyNotes: z.array(z.string().min(1).max(300)).max(6),
});

export type ResumeSyncProposalDraft = z.infer<typeof resumeSyncProposalDraftSchema>;
export type ResumeChangeDetection = z.infer<typeof resumeChangeDetectionSchema>;
export type JobFitComparison = z.infer<typeof jobFitComparisonSchema>;
export type RexAssistantTask = z.infer<typeof rexAssistantTaskSchema>;
export type RexNavigationTarget = z.infer<typeof rexNavigationTargetSchema>;
export type RexChatTurn = z.infer<typeof rexChatTurnSchema>;
export type RexSuggestionCard = z.infer<typeof rexSuggestionCardSchema>;
export type RexAssistantResponse = z.infer<typeof rexAssistantResponseSchema>;
export type ResumeImportIntent = z.infer<typeof resumeImportIntentSchema>;
export type ResumeImportApplyMode = z.infer<typeof resumeImportApplyModeSchema>;
export type ResumeImportPlacement = z.infer<typeof resumeImportPlacementSchema>;
export type ResumeImportParse = z.infer<typeof resumeImportParseSchema>;
export type ResumeImportFollowup = z.infer<typeof resumeImportFollowupSchema>;
