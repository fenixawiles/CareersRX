import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  jobFitComparisonSchema,
  rexAssistantResponseSchema,
  resumeImportFollowupSchema,
  resumeImportParseSchema,
  resumeChangeDetectionSchema,
  type JobFitComparison,
  type RexAssistantResponse,
  type RexAssistantTask,
  type RexChatTurn,
  type RexNavigationTarget,
  type RexSuggestionCard,
  type ResumeImportIntent,
  type ResumeImportFollowup,
  type ResumeImportParse,
  type ResumeImportPlacement,
  type ResumeChangeDetection,
} from "@/lib/ai/schemas";
import type {
  SandboxNamedResumeVersion,
  SandboxProfile,
  SandboxResume,
  SandboxResumeImport,
  SandboxResumeSection,
  SandboxRevision,
} from "@/lib/sandbox-types";

type AiResult<T> = {
  output: T;
  model: string;
  fallbackModel?: string;
  rawResponseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  usedFallback: boolean;
  demoMode: boolean;
};

type ResumeAnalysisInput = {
  documentTitle: string;
  previousVersionText?: string | null;
  currentVersionText: string;
  profile: {
    skills: string[];
    licenses: string[];
    certifications: string[];
    preferredCategories: string[];
    preferredStates: string[];
  };
};

type JobFitInput = {
  job: {
    title: string;
    category: string;
    requirements?: string | null;
    requiredLicenses: string[];
    requiredCertifications: string[];
    requiredYearsExp?: number | null;
    city?: string | null;
    state?: string | null;
  };
  profile: {
    skills: string[];
    licenses: string[];
    certifications: string[];
    preferredCategories: string[];
    preferredStates: string[];
  };
  resumeText: string;
};

type ResumeImportInput = {
  fileName: string;
  contentType: string;
  extractedText: string;
  intent: ResumeImportIntent;
  mode: "account" | "demo" | "signup";
  profile: SandboxProfile;
  resume: SandboxResume;
};

type ResumeImportFollowupInput = {
  message: string;
  resumeImport: SandboxResumeImport;
  profile: SandboxProfile;
  resume: SandboxResume;
  mode: "account" | "demo";
};

export type RexAssistantInput = {
  task: RexAssistantTask;
  navigationTarget?: RexNavigationTarget;
  sectionId?: SandboxResumeSection["id"];
  jobTitle?: string;
  message?: string;
  chatHistory?: RexChatTurn[];
  mode: "account" | "demo";
  profile: SandboxProfile;
  resume: SandboxResume;
  namedVersions: SandboxNamedResumeVersion[];
  revisions: SandboxRevision[];
};

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function modelConfig() {
  return {
    model: process.env.OPENAI_MODEL ?? "gpt-5.4",
    fallbackModel: process.env.OPENAI_FALLBACK_MODEL ?? "gpt-5.2",
    store: process.env.OPENAI_STORE_RESPONSES === "true",
  };
}

function usageFrom(response: unknown) {
  const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return {
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
  };
}

function includesAny(text: string, values: string[]) {
  const lower = text.toLowerCase();
  return values.some((value) => lower.includes(value.toLowerCase()));
}

function plainTextFromRichText(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function selectedSection(input: RexAssistantInput) {
  const targetSectionId =
    input.task === "review_summary" || input.task === "resume_hygiene" ? "summary" : input.sectionId;
  return input.resume.sections.find((section) => section.id === targetSectionId) ?? null;
}

function sectionTitle(sectionId: SandboxResumeSection["id"]) {
  const titles: Record<SandboxResumeSection["id"], string> = {
    summary: "Professional Summary",
    experience: "Experience",
    credentials: "Credentials",
    skills: "Skills",
    preferences: "Role Preferences",
  };
  return titles[sectionId];
}

function normalizeList(text: string) {
  return plainTextFromRichText(text)
    .split(/\n|,|·|•|;/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function mergeSkillsPatch(existingContent: string, suggestedSkills: string[]) {
  const existingSkills = normalizeList(existingContent);
  const existingKeys = new Set(existingSkills.map((skill) => skill.toLowerCase()));
  const additions = suggestedSkills.filter((skill) => !existingKeys.has(skill.toLowerCase()));
  return [...existingSkills, ...additions].join(" · ");
}

function defaultSkillSuggestions(role: string) {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes("nurse") || lowerRole.includes("rn") || lowerRole.includes("care")) {
    return ["Care coordination", "Patient communication", "Documentation", "Medication safety"];
  }
  if (lowerRole.includes("manager") || lowerRole.includes("lead")) {
    return ["Team leadership", "Scheduling", "Process improvement", "Stakeholder communication"];
  }
  return ["Communication", "Documentation", "Workflow coordination", "Problem solving"];
}

function normalizeExtractedResumeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const importHeadingPatterns: Record<SandboxResumeSection["id"], RegExp[]> = {
  summary: [/^(professional\s+)?summary\b/i, /^profile\b/i, /^objective\b/i, /^about\b/i],
  experience: [/^(professional\s+)?experience\b/i, /^work\s+history\b/i, /^employment\b/i, /^career\s+history\b/i],
  credentials: [/^credentials\b/i, /^certifications?\b/i, /^licenses?\b/i, /^education\b/i, /^training\b/i],
  skills: [/^skills\b/i, /^technical\s+skills\b/i, /^core\s+competenc/i, /^competencies\b/i],
  preferences: [/^preferences\b/i, /^target\s+roles?\b/i, /^locations?\b/i],
};

function headingSection(line: string): SandboxResumeSection["id"] | null {
  const cleaned = line.trim().replace(/:$/, "");
  for (const [sectionId, patterns] of Object.entries(importHeadingPatterns) as Array<
    [SandboxResumeSection["id"], RegExp[]]
  >) {
    if (patterns.some((pattern) => pattern.test(cleaned))) return sectionId;
  }
  return null;
}

function splitImportedSections(text: string) {
  const sections: Partial<Record<SandboxResumeSection["id"], string[]>> = {};
  let currentSection: SandboxResumeSection["id"] | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (currentSection) sections[currentSection]?.push("");
      continue;
    }
    const nextSection = headingSection(line);
    if (nextSection) {
      currentSection = nextSection;
      sections[currentSection] ??= [];
      continue;
    }
    if (currentSection) {
      sections[currentSection] ??= [];
      sections[currentSection]?.push(line);
    }
  }
  return Object.fromEntries(
    Object.entries(sections).map(([sectionId, lines]) => [
      sectionId,
      (lines ?? []).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    ]),
  ) as Partial<Record<SandboxResumeSection["id"], string>>;
}

function likelyRole(lines: string[], fallback: string) {
  return (
    lines.find((line) =>
      /\b(manager|engineer|developer|designer|nurse|rn|lpn|cna|therapist|director|coordinator|specialist|analyst|administrator|assistant|operator|lead)\b/i.test(
        line,
      ),
    ) ?? fallback
  ).slice(0, 160);
}

function placement(
  sectionId: SandboxResumeSection["id"],
  content: string,
  confidence: number,
  notes: string[] = [],
): ResumeImportPlacement {
  return {
    sectionId,
    title: sectionTitle(sectionId),
    content,
    sourceEvidence: content.slice(0, 1000),
    confidence,
    notes,
  };
}

function deterministicResumeImport(input: ResumeImportInput): ResumeImportParse {
  const text = normalizeExtractedResumeText(input.extractedText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const sections = splitImportedSections(text);
  const fallbackBody = lines.slice(1).join("\n");
  const firstLine = lines[0] ?? "Uploaded résumé";
  const targetRole = likelyRole(lines.slice(0, 8), input.resume.targetRole);
  const summary =
    sections.summary ||
    lines
      .slice(1, 5)
      .join(" ")
      .slice(0, 900);
  const experience = sections.experience || fallbackBody.slice(0, 12000);
  const credentials = sections.credentials || "";
  const skills = sections.skills || "";
  const preferences = sections.preferences || (targetRole ? `Roles:\n${targetRole}` : "");
  const placements = [
    placement("summary", summary, sections.summary ? 74 : 48, sections.summary ? [] : ["Rex inferred this from the top of the document."]),
    placement("experience", experience, sections.experience ? 76 : 45, sections.experience ? [] : ["Rex placed the remaining résumé body here for review."]),
    placement("credentials", credentials, credentials ? 70 : 35),
    placement("skills", skills, skills ? 70 : 35),
    placement("preferences", preferences, targetRole ? 58 : 35),
  ].filter((item) => item.content.trim().length > 0);

  return {
    assistantName: "Rex",
    answer:
      "I’m Rex, your CareersRX résumé and profile assistant. I extracted readable text and prepared a review-first placement map. Review these sections before creating or replacing a résumé draft.",
    resumeTitle: `${firstLine.slice(0, 80)} — Imported Draft`,
    targetRole,
    placements,
    suggestions: [
      "Review section placement before applying; extraction can lose visual context from multi-column résumés.",
      "After applying, save or sync only the details that should update your public profile.",
    ],
    ambiguousItems: sections.experience ? [] : ["No clear experience heading was detected; review the Experience placement carefully."],
    unsupportedItems: [],
    confidence: sections.experience || sections.summary ? 68 : 45,
    safetyNotes: ["The original file is not stored. CareersRX keeps extracted text and Rex’s review for this import."],
  };
}

function deterministicResumeImportFollowup(input: ResumeImportFollowupInput): ResumeImportFollowup {
  const sectionNames = input.resumeImport.parsedResult.placements
    .map((placementItem) => placementItem.title)
    .filter(Boolean)
    .join(", ");

  return {
    assistantName: "Rex",
    answer:
      "I’m Rex, your CareersRX résumé and profile assistant. I can help you review the uploaded résumé placement map, but I will not move data or update your public profile automatically. If a detail belongs elsewhere, apply the import draft, edit the matching live résumé section, then choose whether that saved section updates the profile.",
    suggestions: [
      sectionNames ? `Review the proposed ${sectionNames} sections before applying.` : "Review each proposed section before applying.",
      "Keep role-specific wording résumé-only if it should not appear on the public profile.",
      "Use Update Profile only for facts you want visible on the public profile.",
    ],
    safetyNotes: ["Import follow-ups do not update your résumé or profile automatically."],
  };
}

function navigationLinks(mode: RexAssistantInput["mode"]) {
  const profileHref = mode === "demo" ? "/demo/profile" : "/dashboard/seeker/profile";
  const resumeHref = mode === "demo" ? "/demo/live-resume" : "/dashboard/seeker/resume";
  return {
    profile: { label: "Open profile", href: profileHref },
    live_resume: { label: "Open live résumé", href: resumeHref },
    applications: { label: "Open applications", href: "/dashboard/seeker/applications" },
    saved_jobs: { label: "Open saved jobs", href: "/dashboard/seeker/saved" },
    account: { label: "Open account settings", href: "/dashboard/seeker/account" },
    privacy: { label: "Read privacy policy", href: "/privacy" },
    terms: { label: "Read terms", href: "/terms" },
    safety: { label: "Review safety guidance", href: "/safety" },
    contact: { label: "Contact CareersRX", href: "/contact" },
  } satisfies Record<RexNavigationTarget, { label: string; href: string }>;
}

function deterministicRexNavigation(input: RexAssistantInput): RexAssistantResponse {
  const target = input.navigationTarget ?? "profile";
  const link = navigationLinks(input.mode)[target];
  return {
    assistantName: "Rex",
    answer: `I’m Rex, your CareersRX résumé and profile assistant. You can use this link to go directly there: ${link.label}.`,
    suggestions: ["If you want résumé or profile help, choose one of the review cards in this panel."],
    link,
    sectionPatch: null,
    sectionId: null,
    suggestionCards: [],
    safetyNotes: ["I only use the current user’s CareersRX profile and live résumé context."],
  };
}

function deterministicRexHelp(input: RexAssistantInput): RexAssistantResponse {
  if (input.task === "privacy_data") {
    return {
      assistantName: "Rex",
      answer:
        "I’m Rex, your CareersRX résumé and profile assistant. For this workspace, I can only use your current profile and live résumé context. Profile changes still require your approval, and CareersRX keeps privacy and safety pages available for more detail.",
      suggestions: [
        "Review what employers see on your public profile.",
        "Use the live résumé workspace to choose what syncs to your profile.",
      ],
      link: navigationLinks(input.mode).privacy,
      sectionPatch: null,
      sectionId: null,
      suggestionCards: [],
      safetyNotes: ["I do not access other seekers, employer dashboards, admin data, or candidate rankings."],
    };
  }

  return {
    assistantName: "Rex",
    answer:
      "I’m Rex, your CareersRX résumé and profile assistant. Your live résumé is where you edit details. When a section may affect your public profile, CareersRX asks whether to update the profile or keep the change résumé-only.",
    suggestions: [
      "Use Save Section after editing one section.",
      "Choose Update Profile only when the change should appear publicly.",
      "Choose Keep Résumé Only for role-specific wording.",
    ],
    link: navigationLinks(input.mode).live_resume,
    sectionPatch: null,
    sectionId: null,
    suggestionCards: [],
    safetyNotes: ["Profile updates require explicit approval."],
  };
}

function deterministicRexAssistant(input: RexAssistantInput): RexAssistantResponse {
  const section = selectedSection(input);
  if (input.task === "custom_chat") {
    return {
      assistantName: "Rex",
      answer:
        "I’m Rex, your CareersRX résumé and profile assistant. I can answer questions about your current profile, live résumé, sync choices, and how to improve sections without changing public profile data automatically.",
      suggestions: [
        "Ask me to tighten a specific résumé section.",
        "Ask what should stay résumé-only versus profile-wide.",
        "Open the live résumé workspace to apply draft text safely.",
      ],
      sectionPatch: null,
      sectionId: null,
      suggestionCards: [],
      link: navigationLinks(input.mode).live_resume,
      safetyNotes: ["Profile updates still require explicit approval."],
    };
  }

  if (input.task === "suggest_skills_for_role") {
    const role = input.jobTitle?.trim() || input.resume.targetRole || "the target role";
    const skillsSection = input.resume.sections.find((resumeSection) => resumeSection.id === "skills");
    const suggestedSkills = defaultSkillSuggestions(role);
    return {
      assistantName: "Rex",
      answer: `I’m Rex, your CareersRX résumé and profile assistant. For ${role}, consider whether your real experience supports adding a focused mix of role tools, patient/client-facing strengths, workflow skills, and measurable leadership skills.`,
      suggestions: [
        "Only add skills you can defend in an interview.",
        "Prefer specific tools, systems, certifications, and measurable workflows over vague traits.",
        "Use the skills section, then save it and approve profile sync if those skills should be public.",
      ],
      sectionPatch: null,
      sectionId: null,
      suggestionCards: [
        {
          id: "skills-for-role",
          title: `Skills to consider for ${role}`,
          body: `If these are accurate, add: ${suggestedSkills.join(", ")}.`,
          targetSectionId: "skills",
          patch: mergeSkillsPatch(skillsSection?.content ?? "", suggestedSkills),
          actionLabel: "Apply to Skills",
        },
      ],
      link: null,
      safetyNotes: ["Suggested skills are not added automatically."],
    };
  }

  if (!section) {
    return {
      assistantName: "Rex",
      answer:
        "I’m Rex, your CareersRX résumé and profile assistant. Pick a résumé section first, and I can review it for clarity, formatting, and profile-safe improvements.",
      suggestions: ["Try Professional Summary or Experience first."],
      sectionPatch: null,
      sectionId: null,
      suggestionCards: [],
      link: null,
      safetyNotes: ["I only review sections in the current user’s live résumé."],
    };
  }

  if (input.task === "resume_hygiene") {
    return {
      assistantName: "Rex",
      answer:
        "I’m Rex, your CareersRX résumé and profile assistant. I checked the résumé structure and found a few safe hygiene improvements to review.",
      suggestions: [
        "Keep bullets specific and outcome-oriented.",
        "Avoid adding credentials or systems unless they are accurate.",
        "Save edited sections before choosing profile sync.",
      ],
      sectionPatch: null,
      sectionId: null,
      suggestionCards: [
        {
          id: "summary-hygiene",
          title: "Tighten the summary",
          body: "Make the summary 2–4 lines with target role, strongest evidence, and supported specialties.",
          targetSectionId: "summary",
          patch: section.id === "summary" ? section.content : null,
          actionLabel: "Review Summary",
        },
      ],
      link: null,
      safetyNotes: ["No profile data changes unless you approve sync after saving."],
    };
  }

  return {
    assistantName: "Rex",
    answer: `I’m Rex, your CareersRX résumé and profile assistant. I can review ${section.title} and suggest improvements, but the API key is not configured for live GPT suggestions in this environment.`,
    suggestions: [
      "Make the first sentence specific to the target role.",
      "Keep claims factual and supported by your profile.",
      "Use concise bullets for experience and skills.",
    ],
    sectionPatch: null,
    sectionId: section.id,
    suggestionCards: [
      {
        id: `${section.id}-review`,
        title: `Review ${section.title}`,
        body: "Use Rex’s guidance to tighten this section, then save it and choose whether it updates your profile.",
        targetSectionId: section.id,
        patch: section.content,
        actionLabel: `Apply to ${sectionTitle(section.id)}`,
      },
    ],
    link: null,
    safetyNotes: ["No résumé or profile content was changed."],
  };
}

function deterministicResumeAnalysis(input: ResumeAnalysisInput): ResumeChangeDetection {
  const currentText = input.currentVersionText.toLowerCase();
  const proposals: ResumeChangeDetection["proposals"] = [];
  const unsupportedClaims: string[] = [];

  if (
    includesAny(currentText, ["nurse practitioner", " aprn", " np "]) &&
    !input.profile.licenses.some((license) => /np|aprn|nurse practitioner/i.test(license))
  ) {
    unsupportedClaims.push("Nurse Practitioner credential is not present in the structured profile.");
    proposals.push({
      target: "LICENSES",
      scope: "PROFILE_UPDATE",
      title: "Review NP license before profile sync",
      summary:
        "The résumé draft references nurse practitioner positioning, but the structured profile does not contain an active NP credential.",
      reason:
        "CareersRX can prepare a review-required credential record, but the seeker must confirm the license before it becomes application-ready.",
      confidence: 54,
      beforeValue: { licenses: input.profile.licenses },
      proposedValue: {
        credential: {
          kind: "LICENSE",
          name: "Nurse Practitioner",
          status: "REVIEW_REQUIRED",
        },
      },
    });
  }

  if (
    includesAny(currentText, ["registered nurse", " rn "]) &&
    !input.profile.licenses.some((license) => /^rn$|registered nurse/i.test(license))
  ) {
    unsupportedClaims.push("Registered Nurse credential is not present in the structured profile.");
  }

  if (
    includesAny(currentText, ["nursing", "nurse"]) &&
    !input.profile.preferredCategories.includes("Nursing (RN/LPN)")
  ) {
    proposals.push({
      target: "PREFERENCES",
      scope: "PREFERENCES_UPDATE",
      title: "Add nursing roles to preferences",
      summary:
        "The edited résumé targets nursing roles. Add Nursing (RN/LPN) to preferences without removing existing CNA or Memory Care preferences.",
      confidence: 76,
      beforeValue: { preferredCategories: input.profile.preferredCategories },
      proposedValue: { preferredCategories: ["Nursing (RN/LPN)"] },
    });
  }

  if (proposals.length === 0) {
    proposals.push({
      target: "RESUME_VARIANT",
      scope: "RESUME_ONLY",
      title: "Keep wording edit résumé-only",
      summary:
        "The change appears to improve résumé wording without adding new factual credentials, preferences, or work history.",
      reason: "Résumé wording changes should not rewrite structured profile data.",
      confidence: 88,
      proposedValue: { resumeOnly: true },
    });
  }

  return {
    proposals,
    unsupportedClaims,
    safetyNotes: [
      "AI suggestions are drafts. Only confirmed changes update the structured profile.",
      "Credentials must be supported by user-confirmed source data before application use.",
    ],
  };
}

function deterministicJobFit(input: JobFitInput): JobFitComparison {
  const profileLicenses = new Set(input.profile.licenses.map((item) => item.toLowerCase()));
  const profileCerts = new Set(input.profile.certifications.map((item) => item.toLowerCase()));
  const resumeText = input.resumeText.toLowerCase();

  const missingLicenses = input.job.requiredLicenses.filter(
    (license) => !profileLicenses.has(license.toLowerCase()),
  );
  const missingCertifications = input.job.requiredCertifications.filter(
    (cert) => !profileCerts.has(cert.toLowerCase()),
  );

  const supportedMatches: JobFitComparison["supportedMatches"] = [];
  for (const license of input.job.requiredLicenses) {
    if (profileLicenses.has(license.toLowerCase())) {
      supportedMatches.push({
        kind: "license",
        label: license,
        evidence: "Present in the structured profile licenses.",
      });
    }
  }
  for (const cert of input.job.requiredCertifications) {
    if (profileCerts.has(cert.toLowerCase())) {
      supportedMatches.push({
        kind: "certification",
        label: cert,
        evidence: "Present in the structured profile certifications.",
      });
    }
  }
  for (const skill of input.profile.skills) {
    if (resumeText.includes(skill.toLowerCase())) {
      supportedMatches.push({
        kind: "skill",
        label: skill,
        evidence: "Supported by both profile data and résumé text.",
      });
    }
  }

  const missingRequirements: JobFitComparison["missingRequirements"] = [
    ...missingLicenses.map((license) => ({
      kind: "license" as const,
      label: license,
      reason: "Required by the job but not present in the structured profile.",
    })),
    ...missingCertifications.map((certification) => ({
      kind: "certification" as const,
      label: certification,
      reason: "Required by the job but not present in the structured profile.",
    })),
  ];

  if (/epic/i.test(input.job.requirements ?? "") && !includesAny(resumeText, ["epic"])) {
    missingRequirements.push({
      kind: "skill",
      label: "Epic",
      reason: "Mentioned in job requirements but not supported by the résumé or profile.",
    });
  }

  const recommendation = missingRequirements.length === 0 ? "READY" : "NEEDS_REVIEW";

  return {
    fitSummary:
      missingRequirements.length === 0
        ? "The packet has supported matches for the listed job requirements."
        : "The packet has useful matches, but missing requirements need review before applying.",
    supportedMatches: supportedMatches.slice(0, 20),
    missingRequirements,
    unsupportedClaims: [],
    recommendation,
  };
}

async function parseWithFallback<T>({
  schemaName,
  schema,
  instructions,
  input,
}: {
  schemaName: string;
  schema: Parameters<typeof zodTextFormat>[0];
  instructions: string;
  input: string;
}): Promise<AiResult<T>> {
  const client = getClient();
  const { model, fallbackModel, store } = modelConfig();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  const openai = client;

  async function run(modelName: string) {
    const response = await openai.responses.parse({
      model: modelName,
      store,
      instructions,
      input,
      reasoning: { effort: "low" },
      text: {
        format: zodTextFormat(schema, schemaName),
        verbosity: "low",
      },
    });
    const output = response.output_parsed;
    if (!output) throw new Error("OpenAI returned no parsed structured output.");
    return {
      output: output as T,
      rawResponseId: response.id,
      ...usageFrom(response),
    };
  }

  try {
    const result = await run(model);
    return { ...result, model, fallbackModel, usedFallback: false, demoMode: false };
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === model) throw primaryError;
    const result = await run(fallbackModel);
    return { ...result, model: fallbackModel, fallbackModel, usedFallback: true, demoMode: false };
  }
}

export async function detectResumeChanges(input: ResumeAnalysisInput): Promise<AiResult<ResumeChangeDetection>> {
  const { fallbackModel } = modelConfig();
  if (!process.env.OPENAI_API_KEY) {
    return {
      output: deterministicResumeAnalysis(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const result = await parseWithFallback<ResumeChangeDetection>({
    schemaName: "careersrx_resume_change_detection",
    schema: resumeChangeDetectionSchema,
    instructions:
      "You are CareersRX, a constrained résumé sync reviewer. Propose reviewable sync changes only. Do not invent credentials, skills, employers, dates, or licenses. Wording-only edits should remain RESUME_ONLY. Missing or unsupported claims must be flagged instead of added.",
    input: JSON.stringify(input),
  });

  return {
    ...result,
    output: resumeChangeDetectionSchema.parse(result.output),
  };
}

export async function compareJobFit(input: JobFitInput): Promise<AiResult<JobFitComparison>> {
  const { fallbackModel } = modelConfig();
  if (!process.env.OPENAI_API_KEY) {
    return {
      output: deterministicJobFit(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const result = await parseWithFallback<JobFitComparison>({
    schemaName: "careersrx_job_fit_comparison",
    schema: jobFitComparisonSchema,
    instructions:
      "You are CareersRX, a seeker-side application packet reviewer. Compare the job, structured profile, and selected résumé. Surface supported matches and missing requirements. Never add skills or credentials that are not supported by the profile or résumé. Do not rank candidates for employers.",
    input: JSON.stringify(input),
  });

  return {
    ...result,
    output: jobFitComparisonSchema.parse(result.output),
  };
}

export async function parseUploadedResumeWithRex(
  input: ResumeImportInput,
): Promise<AiResult<ResumeImportParse>> {
  const { fallbackModel } = modelConfig();
  if (!process.env.OPENAI_API_KEY) {
    return {
      output: deterministicResumeImport(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const safeContext = {
    task: "parse_uploaded_resume",
    fileName: input.fileName,
    contentType: input.contentType,
    intent: input.intent,
    extractedText: normalizeExtractedResumeText(input.extractedText),
    currentProfile: {
      headline: input.profile.headline,
      location: input.profile.location,
      summary: plainTextFromRichText(input.profile.summary),
      experience: plainTextFromRichText(input.profile.experience),
      skills: input.profile.skills,
      credentials: input.profile.credentials,
      preferences: input.profile.preferences,
    },
    currentResume: {
      title: input.resume.title,
      targetRole: input.resume.targetRole,
      sections: input.resume.sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: plainTextFromRichText(section.content),
      })),
    },
  };

  let result: AiResult<ResumeImportParse>;
  try {
    result = await parseWithFallback<ResumeImportParse>({
      schemaName: "careersrx_resume_import_parse",
      schema: resumeImportParseSchema,
      instructions:
        "You are Rex, the CareersRX résumé and profile assistant. Organize extracted résumé text into the existing live résumé sections only: summary, experience, credentials, skills, and preferences. Preserve factual details without inventing employers, dates, credentials, tools, skills, locations, or licenses. If extraction appears messy, place content where it most likely belongs and list ambiguity. This is review-first: do not imply that the public profile changed. Return concise placement notes and practical suggestions.",
      input: JSON.stringify(safeContext),
    });
  } catch {
    return {
      output: deterministicResumeImport(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const parsed = resumeImportParseSchema.parse(result.output);
  const validSectionIds = new Set(input.resume.sections.map((section) => section.id));
  const output: ResumeImportParse = {
    ...parsed,
    placements: parsed.placements
      .filter((placementItem) => validSectionIds.has(placementItem.sectionId))
      .slice(0, 5),
    safetyNotes: [
      ...(parsed.safetyNotes ?? []),
      "Profile updates still require your approval through CareersRX sync.",
    ].slice(0, 6),
  };

  return {
    ...result,
    output,
  };
}

export async function answerResumeImportFollowupWithRex(
  input: ResumeImportFollowupInput,
): Promise<AiResult<ResumeImportFollowup>> {
  const { fallbackModel } = modelConfig();
  if (!process.env.OPENAI_API_KEY) {
    return {
      output: deterministicResumeImportFollowup(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const safeContext = {
    task: "resume_import_followup",
    message: input.message,
    import: {
      fileName: input.resumeImport.fileName,
      contentType: input.resumeImport.contentType,
      extractedText: normalizeExtractedResumeText(input.resumeImport.extractedText),
      parsedResult: input.resumeImport.parsedResult,
      intent: input.resumeImport.intent,
    },
    currentProfile: {
      headline: input.profile.headline,
      location: input.profile.location,
      summary: plainTextFromRichText(input.profile.summary),
      experience: plainTextFromRichText(input.profile.experience),
      skills: input.profile.skills,
      credentials: input.profile.credentials,
      preferences: input.profile.preferences,
    },
    currentResume: {
      title: input.resume.title,
      targetRole: input.resume.targetRole,
      sections: input.resume.sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: plainTextFromRichText(section.content),
        syncStatus: section.syncStatus,
      })),
    },
  };

  let result: AiResult<ResumeImportFollowup>;
  try {
    result = await parseWithFallback<ResumeImportFollowup>({
      schemaName: "careersrx_resume_import_followup",
      schema: resumeImportFollowupSchema,
      instructions:
        "You are Rex, the CareersRX résumé and profile assistant. Answer only questions about this uploaded résumé import, section placement, rewrite/move guidance, profile sync implications, and supported next steps. Use only the current user's supplied import, profile, and live résumé context. Do not invent credentials, employers, dates, skills, licenses, or tools. Do not claim the public profile changed. Keep answers concise and mention that applying/importing still requires user approval before profile sync.",
      input: JSON.stringify(safeContext),
    });
  } catch {
    return {
      output: deterministicResumeImportFollowup(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const parsed = resumeImportFollowupSchema.parse(result.output);

  return {
    ...result,
    output: {
      ...parsed,
      safetyNotes: [
        ...parsed.safetyNotes,
        "Import follow-ups do not update your résumé or profile automatically.",
      ].slice(0, 6),
    },
  };
}

export async function answerRexAssistant(
  input: RexAssistantInput,
): Promise<AiResult<RexAssistantResponse>> {
  const { fallbackModel } = modelConfig();
  if (input.task === "site_navigation") {
    return {
      output: deterministicRexNavigation(input),
      model: "deterministic-links",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  if (input.task === "profile_sync_help" || input.task === "privacy_data") {
    return {
      output: deterministicRexHelp(input),
      model: "deterministic-help",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      output: deterministicRexAssistant(input),
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const section = selectedSection(input);
  const validSectionIds = new Set(input.resume.sections.map((resumeSection) => resumeSection.id));
  const safeContext = {
    task: input.task,
    jobTitle: input.jobTitle,
    message: input.message,
    chatHistory: (input.chatHistory ?? []).slice(-6),
    selectedSection: section
      ? {
          id: section.id,
          title: section.title,
          content: plainTextFromRichText(section.content),
          syncStatus: section.syncStatus,
        }
      : null,
    profile: {
      fullName: input.profile.fullName,
      headline: input.profile.headline,
      location: input.profile.location,
      summary: plainTextFromRichText(input.profile.summary),
      experience: plainTextFromRichText(input.profile.experience),
      skills: input.profile.skills,
      credentials: input.profile.credentials,
      preferences: input.profile.preferences,
    },
    resume: {
      title: input.resume.title,
      targetRole: input.resume.targetRole,
      sections: input.resume.sections.map((resumeSection) => ({
        id: resumeSection.id,
        title: resumeSection.title,
        content: plainTextFromRichText(resumeSection.content),
        syncStatus: resumeSection.syncStatus,
      })),
      activeNamedVersion: input.namedVersions.find((version) => version.isCurrent)
        ? {
            title: input.namedVersions.find((version) => version.isCurrent)?.title,
            purpose: input.namedVersions.find((version) => version.isCurrent)?.purpose,
            status: input.namedVersions.find((version) => version.isCurrent)?.status,
          }
        : null,
      recentRevisionCount: input.revisions.length,
    },
  };

  let result: AiResult<RexAssistantResponse>;
  try {
    result = await parseWithFallback<RexAssistantResponse>({
      schemaName: "careersrx_rex_assistant",
      schema: rexAssistantResponseSchema,
      instructions:
        "You are Rex, the CareersRX résumé and profile assistant for a job board. Introduce yourself as Rex when helpful. Be calm, concise, professional, and not cute or robotic. You can only use the current user's provided profile and live résumé context. Do not claim access to other users, employers, admin data, rankings, or private platform-wide records. Do not mutate profile data. For rewrite tasks, return an optional sectionPatch only for the selected section. For resume_hygiene, suggest_skills_for_role, and useful chat answers, return suggestionCards when there is a safe editor-only change; each card must target an existing section or use null with patch null. Skills suggestions must be framed as items to consider only if accurate. If the request is outside résumé/profile/site help, decline briefly and point to the supported prompt cards.",
      input: JSON.stringify(safeContext),
    });
  } catch {
    return {
      output: {
        ...deterministicRexAssistant(input),
        safetyNotes: [
          "Rex could not reach GPT for this request, so CareersRX returned a safe local review.",
          "Profile updates still require your approval through CareersRX sync.",
        ],
      },
      model: "demo-rules",
      fallbackModel,
      usedFallback: false,
      demoMode: true,
    };
  }

  const parsed = rexAssistantResponseSchema.parse(result.output);
  const safeSectionId = section?.id;
  const suggestionCards: RexSuggestionCard[] = parsed.suggestionCards
    .map((card) => {
      if (!card.targetSectionId || !validSectionIds.has(card.targetSectionId)) {
        return { ...card, targetSectionId: null, patch: null };
      }
      return card;
    })
    .slice(0, 6);
  const output: RexAssistantResponse = {
    ...parsed,
    sectionPatch: parsed.sectionId && parsed.sectionId !== safeSectionId ? null : parsed.sectionPatch,
    sectionId: parsed.sectionPatch ? (safeSectionId ?? null) : parsed.sectionId,
    suggestionCards,
    safetyNotes: [
      ...(parsed.safetyNotes ?? []),
      "Profile updates still require your approval through CareersRX sync.",
    ].slice(0, 6),
  };

  return {
    ...result,
    output,
  };
}
