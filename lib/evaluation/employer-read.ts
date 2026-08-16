import "server-only";

import { query, queryOne } from "@/lib/db/sql";
import { deriveCounters, type EvaluationCounters } from "@/lib/evaluation/derive-counters";

export type EmployerFinding = {
  criterionId: string;
  label: string;
  statement: string;
  disposition: "MANDATORY" | "PREFERRED" | "INFORMATIONAL";
  evaluationMode: "DETERMINISTIC" | "EVIDENCE_MAPPING" | "HUMAN_ONLY";
  assessment: "SATISFIED" | "NOT_SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT" | null;
  findingId: string | null;
  reasonCode: string | null;
  requiresHumanReview: boolean;
};

export type EmployerApplicationEvaluation = {
  evaluationId: string | null;
  evaluationState: string;
  findings: EmployerFinding[];
  counters: EvaluationCounters;
};

export async function getEmployerApplicationEvaluation(companyId: string, applicationId: string): Promise<EmployerApplicationEvaluation | null> {
  const application = await queryOne<{ criteria_set_id: string; evaluation_state: string }>(
    `SELECT application.criteria_set_id, application.evaluation_state
     FROM applications application
     JOIN jobs job ON job.id = application.job_id
     WHERE application.id = ? AND job.company_id = ?`,
    [applicationId, companyId],
  );
  if (!application) return null;
  const evaluation = await queryOne<{ id: string; state: string }>(
    `SELECT id, state FROM application_evaluations
     WHERE application_id = ? ORDER BY run_number DESC LIMIT 1`,
    [applicationId],
  );
  const findingRows = await query<{
    id: string; label: string; statement: string; disposition: EmployerFinding["disposition"]; evaluation_mode: EmployerFinding["evaluationMode"];
    finding_id: string | null; assessment_state: EmployerFinding["assessment"]; reason_code: string | null; requires_human_review: number;
  }>(
    `SELECT criterion.id, criterion.label, criterion.statement, criterion.disposition, criterion.evaluation_mode,
            finding.id AS finding_id, finding.assessment_state, finding.reason_code, criterion.requires_human_review
     FROM job_criteria criterion
     LEFT JOIN criterion_findings finding ON finding.criterion_id = criterion.id AND finding.evaluation_id = ?
     WHERE criterion.criteria_set_id = ? ORDER BY criterion.ordinal ASC`,
    [evaluation?.id ?? "", application.criteria_set_id],
  );
  const findings = findingRows.map((finding) => ({
    criterionId: finding.id,
    label: finding.label,
    statement: finding.statement,
    disposition: finding.disposition,
    evaluationMode: finding.evaluation_mode,
    assessment: finding.assessment_state,
    findingId: finding.finding_id,
    reasonCode: finding.reason_code,
    requiresHumanReview: Number(finding.requires_human_review) === 1,
  }));
  return {
    evaluationId: evaluation?.id ?? null,
    evaluationState: evaluation?.state ?? application.evaluation_state,
    findings,
    counters: deriveCounters(findings.map((finding) => ({ id: finding.criterionId, disposition: finding.disposition, finding: finding.assessment ?? undefined }))),
  };
}
