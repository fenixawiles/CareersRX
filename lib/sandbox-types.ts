export type SandboxSyncStatus = "BLANK" | "DRAFT" | "SYNCED" | "NEEDS_REVIEW" | "RESUME_ONLY";

export type SandboxProfile = {
  email: string;
  fullName: string;
  headline: string;
  location: string;
  summary: string;
  experience: string;
  skills: string[];
  credentials: string[];
  preferences: {
    roles: string[];
    locations: string[];
  };
  updatedAt: string;
};

export type SandboxResumeSection = {
  id: "summary" | "experience" | "credentials" | "skills" | "preferences";
  title: string;
  helper: string;
  content: string;
  syncStatus: SandboxSyncStatus;
};

export type SandboxResume = {
  title: string;
  targetRole: string;
  sections: SandboxResumeSection[];
  updatedAt: string;
};

export type SandboxProposalTarget =
  | "PROFILE_SUMMARY"
  | "HEADLINE"
  | "EXPERIENCE"
  | "SKILLS"
  | "CREDENTIALS"
  | "PREFERENCES"
  | "RESUME_ONLY";

export type SandboxProposalScope = "UPDATE_PROFILE" | "RESUME_ONLY";
export type SandboxProposalStatus = "PENDING" | "APPLIED" | "REJECTED";

export type SandboxProposal = {
  id: string;
  title: string;
  summary: string;
  target: SandboxProposalTarget;
  scope: SandboxProposalScope;
  status: SandboxProposalStatus;
  proposedValue: unknown;
  beforeValue: unknown;
  createdAt: string;
  decidedAt: string | null;
};

export type SandboxResumeVersionStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type SandboxResumeImportIntent = "new_version" | "replace_current" | "signup_onboarding";
export type SandboxResumeImportApplyMode = "create_version" | "replace_current" | "fill_signup_fields";
export type SandboxResumeImportStatus = "PARSED" | "APPLIED" | "FAILED";

export type SandboxRevision = {
  id: string;
  parentVersionId: string;
  versionNumber: number;
  source: string;
  note?: string;
  syncSummary?: string;
  createdAt: string;
  resume?: SandboxResume;
};

export type SandboxNamedResumeVersion = {
  id: string;
  title: string;
  purpose: string;
  status: SandboxResumeVersionStatus;
  sourceVersionId: string | null;
  activeRevisionId: string | null;
  revisionCount: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  resume?: SandboxResume;
};

export type SandboxVersion = SandboxRevision;

export type SandboxAuditEntry = {
  id: string;
  action: string;
  target: string;
  beforeValue: unknown;
  afterValue: unknown;
  createdAt: string;
};

export type SandboxResumeImportPlacement = {
  sectionId: SandboxResumeSection["id"];
  title: string;
  content: string;
  sourceEvidence: string;
  confidence: number;
  notes: string[];
};

export type SandboxResumeImportReview = {
  assistantName: "Rex";
  answer: string;
  resumeTitle: string;
  targetRole: string;
  placements: SandboxResumeImportPlacement[];
  suggestions: string[];
  ambiguousItems: string[];
  unsupportedItems: string[];
  confidence: number;
  safetyNotes: string[];
};

export type SandboxResumeImport = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  extractedText: string;
  extractedCharCount: number;
  extractor: string;
  intent: SandboxResumeImportIntent;
  status: SandboxResumeImportStatus;
  parsedResult: SandboxResumeImportReview;
  createdAt: string;
  appliedAt: string | null;
};

export type SandboxSnapshot = {
  profile: SandboxProfile;
  resume: SandboxResume;
  activeVersionId: string | null;
  namedVersions: SandboxNamedResumeVersion[];
  revisions: SandboxRevision[];
  proposals: SandboxProposal[];
  versions: SandboxVersion[];
  audit: SandboxAuditEntry[];
  persistence: {
    kind: "sqlite";
    path: string;
  };
};

export type SandboxSignupInput = {
  email: string;
  fullName: string;
  headline: string;
  location: string;
  summary: string;
  experience: string;
  skills: string[];
  credentials: string[];
  preferredRoles: string[];
  preferredLocations: string[];
};
