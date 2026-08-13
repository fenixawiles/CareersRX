export type ExplanationFinding = {
  criterion: string;
  assessment: "SATISFIED" | "NOT_SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT";
  observed?: string;
};

export type ApplicantExplanationInput = {
  decision: "ADVANCE" | "DO_NOT_ADVANCE" | "REQUEST_MORE_INFO";
  reasonCategory?:
    | "MANDATORY_CRITERION_NOT_MET"
    | "EVIDENCE_INSUFFICIENT_AFTER_REVIEW"
    | "HUMAN_JUDGMENT_CRITERION_NOT_MET"
    | "STRONGER_CANDIDATE_POOL"
    | "POSITION_CLOSED"
    | "ROLE_FILLED"
    | "BUSINESS_NEED_CHANGED"
    | "APPLICANT_UNRESPONSIVE";
  findings?: Array<{
    criterion: string;
    disposition: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
    origin: "DETERMINISTIC_RULE" | "MODEL";
    assessment: ExplanationFinding["assessment"];
  }>;
  humanAssessments?: Array<{
    criterion: string;
    disposition: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
    assessment: "SATISFIED" | "NOT_SATISFIED" | "CANNOT_DETERMINE";
    criterionKind: "HUMAN_JUDGMENT" | "OTHER";
  }>;
};

export type ApplicantExplanation = {
  schemaVersion: "v1";
  decision: ApplicantExplanationInput["decision"];
  reasonCategory: ApplicantExplanationInput["reasonCategory"] | null;
  summary: string;
  reasons: string[];
  notices: string[];
};

const PROTECTED_OR_SENSITIVE_TERMS =
  /\b(date of birth|born\b|pregnan|disab(?:led|ility)|wheelchair|national origin|citizen(?:ship)?|religion|marital status|genetic|family medical|race|ethnic)/i;

function safeCriterion(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed && !PROTECTED_OR_SENSITIVE_TERMS.test(trimmed) ? trimmed : null;
}

export function explanationSentence(finding: ExplanationFinding): string | null {
  const criterion = safeCriterion(finding.criterion);
  if (!criterion) return null;
  switch (finding.assessment) {
    case "INSUFFICIENT_EVIDENCE":
      return `The submitted résumé did not establish ${criterion}.`;
    case "NOT_SATISFIED":
      return finding.observed
        ? `This role required ${criterion}; your application recorded ${finding.observed}.`
        : null;
    case "SATISFIED":
      return `Your application demonstrated ${criterion}.`;
    case "REQUIRES_HUMAN_JUDGMENT":
      return null;
  }
}

/**
 * Produces fixed applicant-facing language from citations already accepted by decision persistence.
 * It never includes model output, confidence, a score, rankings, raw notes, or protected content.
 */
export function buildApplicantExplanation(input: ApplicantExplanationInput): ApplicantExplanation {
  const notices = [
    "This notice describes job-related information and the documented basis for this decision.",
    "It does not use a score, ranking, prediction, or automated hiring decision.",
  ];
  if (input.decision === "ADVANCE") {
    return {
      schemaVersion: "v1",
      decision: input.decision,
      reasonCategory: null,
      summary: "The employer has chosen to advance your application.",
      reasons: [],
      notices,
    };
  }
  if (input.decision === "REQUEST_MORE_INFO") {
    return {
      schemaVersion: "v1",
      decision: input.decision,
      reasonCategory: null,
      summary: "The employer requested additional job-related information before making a decision.",
      reasons: [],
      notices,
    };
  }

  const reasonCategory = input.reasonCategory ?? null;
  const reasons: string[] = [];
  if (reasonCategory === "MANDATORY_CRITERION_NOT_MET") {
    for (const finding of input.findings ?? []) {
      const criterion = safeCriterion(finding.criterion);
      if (criterion && finding.disposition === "MANDATORY" && finding.origin === "DETERMINISTIC_RULE" && finding.assessment === "NOT_SATISFIED") {
        reasons.push(`The application did not meet the posted mandatory requirement for ${criterion}.`);
      }
    }
  }
  if (reasonCategory === "EVIDENCE_INSUFFICIENT_AFTER_REVIEW") {
    for (const finding of input.findings ?? []) {
      const criterion = safeCriterion(finding.criterion);
      if (criterion && finding.disposition === "MANDATORY" && finding.assessment === "INSUFFICIENT_EVIDENCE") {
        reasons.push(`The submitted application did not establish the posted mandatory requirement for ${criterion}.`);
      }
    }
  }
  if (reasonCategory === "HUMAN_JUDGMENT_CRITERION_NOT_MET") {
    for (const assessment of input.humanAssessments ?? []) {
      const criterion = safeCriterion(assessment.criterion);
      if (criterion && assessment.disposition === "MANDATORY" && assessment.criterionKind === "HUMAN_JUDGMENT" && assessment.assessment === "NOT_SATISFIED") {
        reasons.push(`The documented job-related review did not establish the mandatory requirement for ${criterion}.`);
      }
    }
  }
  const factualReasons: Partial<Record<NonNullable<ApplicantExplanationInput["reasonCategory"]>, string>> = {
    STRONGER_CANDIDATE_POOL: "The hiring round moved forward with other applicants using the posted job-related requirements.",
    POSITION_CLOSED: "The position has closed.",
    ROLE_FILLED: "The position has been filled.",
    BUSINESS_NEED_CHANGED: "The employer's business need for this role changed and the hiring round closed.",
    APPLICANT_UNRESPONSIVE: "The employer did not receive a response to a documented request for job-related information within the stated response window.",
  };
  if (reasonCategory && factualReasons[reasonCategory]) reasons.push(factualReasons[reasonCategory]!);

  return {
    schemaVersion: "v1",
    decision: input.decision,
    reasonCategory,
    summary: "The employer has decided not to advance your application.",
    reasons: [...new Set(reasons)],
    notices,
  };
}

export function renderApplicantExplanation(explanation: ApplicantExplanation) {
  return [explanation.summary, ...explanation.reasons, ...explanation.notices].join("\n\n");
}
