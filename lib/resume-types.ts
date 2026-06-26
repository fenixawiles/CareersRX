export type ResumeSectionView = {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  syncStatus: string;
  linkedEntityType: string | null;
  updatedAt: string;
};

export type ResumeVersionView = {
  id: string;
  versionNumber: number;
  sourceType: string;
  aiGenerated: boolean;
  createdAt: string;
};

export type ResumeProposalView = {
  id: string;
  target: string;
  scope: string | null;
  status: string;
  title: string;
  summary: string;
  reason: string | null;
  confidence: number | null;
  createdAt: string;
};

export type ResumeDocumentView = {
  id: string;
  title: string;
  targetRole: string | null;
  status: string;
  variantLabel: string | null;
  updatedAt: string;
  activeVersion: ResumeVersionView | null;
  pendingProposalCount: number;
  sectionCount: number;
};

export type ResumeWorkspaceView = {
  document: ResumeDocumentView;
  sections: ResumeSectionView[];
  versions: ResumeVersionView[];
  proposals: ResumeProposalView[];
  profile: {
    name: string;
    skills: string[];
    licenses: string[];
    certifications: string[];
    preferredCategories: string[];
  };
};

export type ApplicationPacketView = {
  id: string;
  title: string;
  status: string;
  fitSummary: string | null;
  missingRequirements: unknown;
  supportedMatches: unknown;
  updatedAt: string;
  job: {
    title: string;
    companyName: string;
    city: string;
    state: string;
  } | null;
  resumeDocument: {
    id: string;
    title: string;
  } | null;
  resumeVersion: {
    id: string;
    versionNumber: number;
  } | null;
};
