export type DeterministicAssessment = "SATISFIED" | "NOT_SATISFIED" | "INSUFFICIENT_EVIDENCE";

export type DeterministicRule =
  | { type: "license_held"; name: string; state?: string }
  | { type: "credential_held"; name: string }
  | { type: "min_months_experience"; months: number; field?: string }
  | { type: "location_in"; states: string[] }
  | { type: "shift_availability"; shifts: string[] }
  | { type: "attestation"; questionKey: string; expected: boolean };

export type DeterministicInput = {
  licenses?: Array<{ name: string; state?: string }>;
  credentials?: string[];
  experienceMonths?: number;
  locationState?: string;
  shifts?: string[];
  attestations?: Record<string, boolean | undefined>;
};

export type RuleResult = {
  assessment: DeterministicAssessment;
  trace: Record<string, unknown>;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

/**
 * Deterministic rules are intentionally conservative: missing or skipped applicant data is always
 * insufficient evidence. Only an explicit, comparable value can produce NOT_SATISFIED.
 */
export function evaluateDeterministicRule(rule: DeterministicRule, input: DeterministicInput): RuleResult {
  switch (rule.type) {
    case "license_held": {
      if (!input.licenses) return { assessment: "INSUFFICIENT_EVIDENCE", trace: { rule } };
      const match = input.licenses.find(
        (license) =>
          normalized(license.name) === normalized(rule.name) &&
          (!rule.state || normalized(license.state ?? "") === normalized(rule.state)),
      );
      return { assessment: match ? "SATISFIED" : "NOT_SATISFIED", trace: { rule, licenses: input.licenses } };
    }
    case "credential_held": {
      if (!input.credentials) return { assessment: "INSUFFICIENT_EVIDENCE", trace: { rule } };
      return {
        assessment: input.credentials.some((credential) => normalized(credential) === normalized(rule.name))
          ? "SATISFIED"
          : "NOT_SATISFIED",
        trace: { rule, credentials: input.credentials },
      };
    }
    case "min_months_experience":
      if (input.experienceMonths === undefined) return { assessment: "INSUFFICIENT_EVIDENCE", trace: { rule } };
      return {
        assessment: input.experienceMonths >= rule.months ? "SATISFIED" : "NOT_SATISFIED",
        trace: { rule, experienceMonths: input.experienceMonths },
      };
    case "location_in":
      if (!input.locationState) return { assessment: "INSUFFICIENT_EVIDENCE", trace: { rule } };
      return {
        assessment: rule.states.some((state) => normalized(state) === normalized(input.locationState ?? ""))
          ? "SATISFIED"
          : "NOT_SATISFIED",
        trace: { rule, locationState: input.locationState },
      };
    case "shift_availability":
      if (!input.shifts) return { assessment: "INSUFFICIENT_EVIDENCE", trace: { rule } };
      return {
        assessment: rule.shifts.every((shift) => input.shifts?.some((item) => normalized(item) === normalized(shift)))
          ? "SATISFIED"
          : "NOT_SATISFIED",
        trace: { rule, shifts: input.shifts },
      };
    case "attestation": {
      const actual = input.attestations?.[rule.questionKey];
      if (actual === undefined) return { assessment: "INSUFFICIENT_EVIDENCE", trace: { rule } };
      return {
        assessment: actual === rule.expected ? "SATISFIED" : "NOT_SATISFIED",
        trace: { rule, actual },
      };
    }
  }
}
