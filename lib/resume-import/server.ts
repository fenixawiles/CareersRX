import "server-only";

import { parseUploadedResumeWithRex } from "@/lib/ai/openai";
import { extractResumeTextFromFile } from "@/lib/resume-import/extract";
import type {
  ResumeImportIntent,
  ResumeImportParse,
} from "@/lib/ai/schemas";
import type {
  SandboxProfile,
  SandboxResume,
  SandboxResumeImport,
  SandboxResumeSection,
} from "@/lib/sandbox-types";
import {
  createSandboxResumeImport,
  getSandboxSnapshot,
  writeSandboxAiInteraction,
} from "@/lib/sqlite-sandbox";

type ImportMode = "account" | "demo" | "signup";

function uniqueListText(value: string, separator: "\n" | " · ") {
  const seen = new Set<string>();
  const items = value
    .split(/\n|,|·|•|;/)
    .map((item) => item.replace(/^[-*]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return items.join(separator);
}

function blankImportProfile(): SandboxProfile {
  return {
    email: "",
    fullName: "",
    headline: "",
    location: "",
    summary: "",
    experience: "",
    skills: [],
    credentials: [],
    preferences: {
      roles: [],
      locations: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function blankImportResume(): SandboxResume {
  const sections: SandboxResumeSection[] = [
    {
      id: "summary",
      title: "Professional Summary",
      helper: "Imported résumé summary review.",
      content: "",
      syncStatus: "BLANK",
    },
    {
      id: "experience",
      title: "Experience",
      helper: "Imported résumé experience review.",
      content: "",
      syncStatus: "BLANK",
    },
    {
      id: "credentials",
      title: "Credentials",
      helper: "Imported résumé credentials review.",
      content: "",
      syncStatus: "BLANK",
    },
    {
      id: "skills",
      title: "Skills",
      helper: "Imported résumé skills review.",
      content: "",
      syncStatus: "BLANK",
    },
    {
      id: "preferences",
      title: "Role Preferences",
      helper: "Imported résumé role preferences review.",
      content: "",
      syncStatus: "BLANK",
    },
  ];

  return {
    title: "Uploaded résumé",
    targetRole: "",
    sections,
    updatedAt: new Date().toISOString(),
  };
}

export function signupPrefillFromImport(review: ResumeImportParse) {
  const sectionContent = new Map(review.placements.map((placement) => [placement.sectionId, placement.content]));
  return {
    headline: review.targetRole,
    summary: sectionContent.get("summary") ?? "",
    experience: sectionContent.get("experience") ?? "",
    skills: uniqueListText(sectionContent.get("skills") ?? "", " · "),
    credentials: uniqueListText(sectionContent.get("credentials") ?? "", "\n"),
    preferredRoles: review.targetRole,
    preferredLocations: "",
  };
}

export async function runResumeImport({
  file,
  intent,
  mode,
  sandboxId,
}: {
  file: File;
  intent: ResumeImportIntent;
  mode: ImportMode;
  sandboxId?: string;
}): Promise<{
  resumeImport: SandboxResumeImport | null;
  review: ResumeImportParse;
  extractedCharCount: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  extractor: string;
  interactionId?: string;
  demoMode: boolean;
}> {
  const extraction = await extractResumeTextFromFile(file);
  const snapshot = mode === "signup" ? null : getSandboxSnapshot(sandboxId);
  const profile = snapshot?.profile ?? blankImportProfile();
  const resume = snapshot?.resume ?? blankImportResume();
  const ai = await parseUploadedResumeWithRex({
    fileName: extraction.fileName,
    contentType: extraction.contentType,
    extractedText: extraction.extractedText,
    intent,
    mode,
    profile,
    resume,
  });

  let interactionId: string | undefined;
  if (mode !== "signup") {
    interactionId = writeSandboxAiInteraction({
      sandboxId,
      task: "REX_PARSE_UPLOADED_RESUME",
      model: ai.model,
      fallbackModel: ai.fallbackModel,
      status: "SUCCEEDED",
      inputMetadata: {
        fileName: extraction.fileName,
        contentType: extraction.contentType,
        sizeBytes: extraction.sizeBytes,
        extractedCharCount: extraction.extractedText.length,
        intent,
        demoMode: ai.demoMode,
        usedFallback: ai.usedFallback,
      },
      parsedOutput: ai.output,
      rawResponseId: ai.rawResponseId,
      inputTokens: ai.inputTokens,
      outputTokens: ai.outputTokens,
    });
  }

  const resumeImport =
    mode === "signup"
      ? null
      : createSandboxResumeImport(
          {
            fileName: extraction.fileName,
            contentType: extraction.contentType,
            sizeBytes: extraction.sizeBytes,
            extractedText: extraction.extractedText,
            extractor: extraction.extractor,
            intent,
            parsedResult: ai.output,
          },
          sandboxId,
        );

  return {
    resumeImport,
    review: ai.output,
    extractedCharCount: extraction.extractedText.length,
    fileName: extraction.fileName,
    contentType: extraction.contentType,
    sizeBytes: extraction.sizeBytes,
    extractor: extraction.extractor,
    interactionId,
    demoMode: ai.demoMode,
  };
}
