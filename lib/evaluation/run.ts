import "server-only";

import { randomUUID } from "node:crypto";
import { query, queryOne, run, tx } from "@/lib/db/sql";
import { evaluateDeterministicRule, type DeterministicInput, type DeterministicRule } from "@/lib/criteria/rules";

type LockedApplication = {
  id: string;
  company_id: string;
  criteria_set_id: string;
  evaluation_state: string;
  profile_snapshot_json: string;
  resume_snapshot_json: string;
  license_confirmed: number;
};
type LockedCriterion = {
  id: string;
  kind: string;
  disposition: string;
  evaluation_mode: string;
  statement: string;
  deterministic_rule_json: string | null;
  requires_human_review: number;
};

export class DeterministicEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeterministicEvaluationError";
  }
}

function timestamp() {
  return new Date().toISOString();
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function licenses(value: unknown): Array<{ name: string; state?: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [{ name: item.trim() }];
    const candidate = object(item);
    if (typeof candidate.name !== "string" || !candidate.name.trim()) return [];
    return [{ name: candidate.name.trim(), ...(typeof candidate.state === "string" && candidate.state.trim() ? { state: candidate.state.trim() } : {}) }];
  });
  return normalized;
}

function booleanRecord(value: unknown): Record<string, boolean | undefined> | undefined {
  const candidate = object(value);
  const entries = Object.entries(candidate).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function locationState(location: unknown) {
  if (typeof location !== "string" || !location.trim()) return undefined;
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1);
}

function snapshotInput(application: LockedApplication): DeterministicInput {
  let profile: Record<string, unknown>;
  let resume: Record<string, unknown>;
  try {
    profile = object(JSON.parse(application.profile_snapshot_json));
    resume = object(JSON.parse(application.resume_snapshot_json));
  } catch {
    throw new DeterministicEvaluationError("The immutable application snapshot cannot be read.");
  }
  const profileAttestations = booleanRecord(profile.attestations) ?? {};
  // This platform's legacy application confirmation is also a structured, applicant-provided fact.
  profileAttestations.licenseConfirmed = Number(application.license_confirmed) === 1;
  return {
    licenses: licenses(profile.licenses) ?? licenses(resume.licenses),
    credentials: strings(profile.credentials) ?? strings(profile.certifications) ?? strings(resume.credentials) ?? strings(resume.certifications),
    experienceMonths: typeof profile.experienceMonths === "number" && Number.isInteger(profile.experienceMonths) && profile.experienceMonths >= 0
      ? profile.experienceMonths
      : undefined,
    locationState: typeof profile.state === "string" && profile.state.trim() ? profile.state.trim() : locationState(profile.location),
    shifts: strings(profile.shifts) ?? strings(object(profile.preferences).shifts),
    attestations: profileAttestations,
  };
}

function parseRule(serialized: string): DeterministicRule {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new DeterministicEvaluationError("A deterministic criterion has unreadable rule data.");
  }
  const candidate = object(value);
  if (candidate.type === "license_held" && typeof candidate.name === "string") {
    return { type: "license_held", name: candidate.name, ...(typeof candidate.state === "string" ? { state: candidate.state } : {}) };
  }
  if (candidate.type === "credential_held" && typeof candidate.name === "string") return { type: "credential_held", name: candidate.name };
  if (candidate.type === "min_months_experience" && typeof candidate.months === "number" && Number.isInteger(candidate.months)) {
    return { type: "min_months_experience", months: candidate.months, ...(typeof candidate.field === "string" ? { field: candidate.field } : {}) };
  }
  if (candidate.type === "location_in" && strings(candidate.states)?.length) return { type: "location_in", states: strings(candidate.states)! };
  if (candidate.type === "shift_availability" && strings(candidate.shifts)?.length) return { type: "shift_availability", shifts: strings(candidate.shifts)! };
  if (candidate.type === "attestation" && typeof candidate.questionKey === "string" && typeof candidate.expected === "boolean") {
    return { type: "attestation", questionKey: candidate.questionKey, expected: candidate.expected };
  }
  throw new DeterministicEvaluationError("A deterministic criterion has an invalid registered rule.");
}

async function audit(input: { eventType: string; entityId: string; companyId: string; metadata: Record<string, unknown> }) {
  await run(
    `INSERT INTO audit_events (id, event_type, actor_kind, actor_user_id, entity_type, entity_id, company_id, metadata_json, created_at)
     VALUES (?, ?, 'SYSTEM', NULL, 'APPLICATION_EVALUATION', ?, ?, ?, ?)`,
    [randomUUID(), input.eventType, input.entityId, input.companyId, JSON.stringify(input.metadata), timestamp()],
  );
}

async function runDeterministicEvaluation(applicationId: string) {
  const application = await queryOne<LockedApplication>(
    `SELECT application.id, job.company_id, application.criteria_set_id, application.evaluation_state,
            application.profile_snapshot_json, application.resume_snapshot_json, application.license_confirmed
     FROM applications application
     JOIN jobs job ON job.id = application.job_id
     JOIN job_criteria_sets criteria_set ON criteria_set.id = application.criteria_set_id
     WHERE application.id = ? AND criteria_set.status = 'PUBLISHED' AND criteria_set.authoring_state = 'STRUCTURED'`,
    [applicationId],
  );
  if (!application) throw new DeterministicEvaluationError("The application is not locked to a published structured criteria set.");
  if (application.evaluation_state !== "NOT_STARTED") {
    throw new DeterministicEvaluationError("The application is not ready for deterministic evaluation.");
  }
  const existingRun = await queryOne<{ id: string }>("SELECT id FROM application_evaluations WHERE application_id = ?", [application.id]);
  if (existingRun) throw new DeterministicEvaluationError("The application already has an evaluation run.");

  const runRow = await queryOne<{ next_run: number }>(
    "SELECT COALESCE(MAX(run_number), 0) + 1 AS next_run FROM application_evaluations WHERE application_id = ?",
    [application.id],
  );
  const runNumber = Number(runRow?.next_run ?? 1);
  const evaluationId = randomUUID();
  const startedAt = timestamp();
  await run(
    `INSERT INTO application_evaluations (
      id, application_id, criteria_set_id, run_number, state, evaluator_kind, started_at
    ) VALUES (?, ?, ?, ?, 'IN_PROGRESS', 'SYSTEM', ?)`,
    [evaluationId, application.id, application.criteria_set_id, runNumber, startedAt],
  );
  await run("UPDATE applications SET evaluation_state = 'IN_PROGRESS', updated_at = ? WHERE id = ?", [startedAt, application.id]);
  await audit({
    eventType: "EVALUATION_STARTED",
    entityId: evaluationId,
    companyId: application.company_id,
    metadata: { applicationId: application.id, criteriaSetId: application.criteria_set_id, runNumber, evaluator: "SYSTEM" },
  });

  const input = snapshotInput(application);
  const criteria = await query<LockedCriterion>(
    `SELECT id, kind, disposition, evaluation_mode, statement, deterministic_rule_json, requires_human_review
     FROM job_criteria WHERE criteria_set_id = ? ORDER BY ordinal ASC`,
    [application.criteria_set_id],
  );
  let findingCount = 0;
  let partial = false;
  for (const criterion of criteria) {
    if (criterion.evaluation_mode !== "DETERMINISTIC") {
      partial = true;
      continue;
    }
    if (!criterion.deterministic_rule_json) throw new DeterministicEvaluationError("A deterministic criterion is missing its registered rule.");
    const result = evaluateDeterministicRule(parseRule(criterion.deterministic_rule_json), input);
    await run(
      `INSERT INTO criterion_findings (
        id, evaluation_id, criterion_id, criterion_statement_snapshot, criterion_kind_snapshot,
        criterion_disposition_snapshot, finding_origin, assessment_state, confidence, reason_code,
        reasoning_note, requires_human_review, evidence_source_kind, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'DETERMINISTIC_RULE', ?, NULL, 'RULE_COMPARISON', ?, ?, 'SELF_REPORTED', ?)`,
      [
        randomUUID(), evaluationId, criterion.id, criterion.statement, criterion.kind, criterion.disposition,
        result.assessment, JSON.stringify(result.trace), Number(criterion.requires_human_review) === 1 ? 1 : 0, timestamp(),
      ],
    );
    findingCount += 1;
  }
  const state = partial ? "PARTIAL_DETERMINISTIC" : "COMPLETE";
  const completedAt = timestamp();
  await run(
    "UPDATE application_evaluations SET state = ?, completed_at = ? WHERE id = ?",
    [state, completedAt, evaluationId],
  );
  await run("UPDATE applications SET evaluation_state = ?, updated_at = ? WHERE id = ?", [state, completedAt, application.id]);
  await audit({
    eventType: "EVALUATION_FINALIZED",
    entityId: evaluationId,
    companyId: application.company_id,
    metadata: { applicationId: application.id, state, evaluator: "SYSTEM", findingCount },
  });
  return { id: evaluationId, state, findingCount };
}

/** Runs under the caller's open SQLite transaction. This is the submit-time path. */
export async function runDeterministicEvaluationInTransaction(applicationId: string) {
  return await runDeterministicEvaluation(applicationId);
}

/** Test and worker-safe boundary for callers that do not already own the SQLite transaction. */
export async function runDeterministicEvaluationForApplication(applicationId: string) {
  return tx(async () => await runDeterministicEvaluation(applicationId));
}
