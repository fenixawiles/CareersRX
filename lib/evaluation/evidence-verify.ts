export type EvidenceCandidate = {
  snapshotField: string;
  excerpt: string;
  charStart: number;
  charEnd: number;
  claimPolarity: "SUPPORTS" | "CONTRADICTS" | "AMBIGUOUS";
};

export type VerifiedEvidence = EvidenceCandidate & {
  claimPolarity: "SUPPORTS" | "CONTRADICTS" | "AMBIGUOUS";
  protectedContentAdmittedUnderTemplate: boolean;
};

export type EvidenceVerificationOptions = {
  ruleTemplateId?: "LICENSE_ATTESTATION" | "CERTIFICATION_ATTESTATION" | "WORK_AUTHORIZATION_ATTESTATION" | "LEGAL_MINIMUM_AGE";
};

const NEGATION_OR_HEDGE = /\b(not|no|without|lapsed|expired|pursuing|in progress|seeking|willing to obtain)\b/i;
const PROTECTED_CONTENT = /\b(date of birth|born\s+\d{4}|pregnan|disab(?:led|ility)|wheelchair|national origin|citizen(?:ship)?|religion|marital status|genetic|family medical)\b/i;
const PROTECTED_CONTENT_TEMPLATE_EXCEPTIONS = new Set(["LEGAL_MINIMUM_AGE", "WORK_AUTHORIZATION_ATTESTATION"]);

function valueAtPath(snapshot: Record<string, unknown>, path: string): string | null {
  const value = path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) return (current as Record<string, unknown>)[part];
    return undefined;
  }, snapshot);
  return typeof value === "string" ? value : null;
}

/**
 * Evidence must be verbatim and located inside the immutable application snapshot. The protected
 * content screen is deliberately conservative: rejected evidence is never persisted and can only
 * weaken a finding, never strengthen one.
 */
export function verifyEvidence(
  snapshot: Record<string, unknown>,
  candidate: EvidenceCandidate,
  options: EvidenceVerificationOptions = {},
): VerifiedEvidence | null {
  const field = valueAtPath(snapshot, candidate.snapshotField);
  if (!field || candidate.charEnd < candidate.charStart) return null;
  if (field.slice(candidate.charStart, candidate.charEnd) !== candidate.excerpt) return null;
  const protectedContentMatched = PROTECTED_CONTENT.test(candidate.excerpt);
  const protectedContentAdmittedUnderTemplate =
    protectedContentMatched && options.ruleTemplateId !== undefined && PROTECTED_CONTENT_TEMPLATE_EXCEPTIONS.has(options.ruleTemplateId);
  if (protectedContentMatched && !protectedContentAdmittedUnderTemplate) return null;

  const context = field.slice(Math.max(0, candidate.charStart - 48), Math.min(field.length, candidate.charEnd + 48));
  return {
    ...candidate,
    claimPolarity: NEGATION_OR_HEDGE.test(context) ? "AMBIGUOUS" : candidate.claimPolarity,
    protectedContentAdmittedUnderTemplate,
  };
}

export function assessmentAfterEvidence(
  assessment: "SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT",
  evidence: VerifiedEvidence[],
): "SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT" {
  if (assessment === "SATISFIED" && !evidence.some((item) => item.claimPolarity === "SUPPORTS")) {
    return "INSUFFICIENT_EVIDENCE";
  }
  return assessment;
}
