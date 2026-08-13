export type CounterCriterion = {
  id: string;
  disposition: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
  finding?: "SATISFIED" | "NOT_SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT";
};

export type EvaluationCounters = {
  mandatorySatisfied: { count: number; criterionIds: string[] };
  mandatoryTotal: number;
  preferredSatisfied: { count: number; criterionIds: string[] };
  preferredTotal: number;
  unresolved: { count: number; criterionIds: string[] };
  humanReviewRequired: { count: number; criterionIds: string[] };
  notEvaluated: { count: number; criterionIds: string[] };
};

function bucket(criteria: CounterCriterion[], predicate: (criterion: CounterCriterion) => boolean) {
  const criterionIds = criteria.filter(predicate).map((criterion) => criterion.id);
  return { count: criterionIds.length, criterionIds };
}

/**
 * These are independent disclosure counters, not a score or ranking. A missing finding means the
 * platform did not evaluate that criterion; it must never be presented as insufficient evidence.
 */
export function deriveCounters(criteria: CounterCriterion[]): EvaluationCounters {
  const mandatory = criteria.filter((criterion) => criterion.disposition === "MANDATORY");
  const preferred = criteria.filter((criterion) => criterion.disposition === "PREFERRED");
  return {
    mandatorySatisfied: bucket(mandatory, (criterion) => criterion.finding === "SATISFIED"),
    mandatoryTotal: mandatory.length,
    preferredSatisfied: bucket(preferred, (criterion) => criterion.finding === "SATISFIED"),
    preferredTotal: preferred.length,
    unresolved: bucket(criteria, (criterion) => criterion.finding === "INSUFFICIENT_EVIDENCE"),
    humanReviewRequired: bucket(criteria, (criterion) => criterion.finding === "REQUIRES_HUMAN_JUDGMENT"),
    notEvaluated: bucket(criteria, (criterion) => criterion.finding === undefined),
  };
}
