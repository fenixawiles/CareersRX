export type ExplanationFinding = {
  criterion: string;
  assessment: "SATISFIED" | "NOT_SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT";
  observed?: string;
};

export function explanationSentence(finding: ExplanationFinding): string | null {
  switch (finding.assessment) {
    case "INSUFFICIENT_EVIDENCE":
      return `The submitted résumé did not establish ${finding.criterion}.`;
    case "NOT_SATISFIED":
      return finding.observed
        ? `This role required ${finding.criterion}; your application recorded ${finding.observed}.`
        : null;
    case "SATISFIED":
      return `Your application demonstrated ${finding.criterion}.`;
    case "REQUIRES_HUMAN_JUDGMENT":
      return null;
  }
}
