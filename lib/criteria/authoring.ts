import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, queryOne, run, tx } from "@/lib/db/sql";
import { findProhibitedCriterion } from "@/lib/criteria/prohibited";
import type { EmployerActor } from "@/lib/evaluation/persistence";

const criterionKindSchema = z.enum([
  "HARD_ELIGIBILITY",
  "MINIMUM_QUALIFICATION",
  "PREFERRED_QUALIFICATION",
  "COMPENSATORY_MEMBER",
  "HUMAN_JUDGMENT",
]);
const dispositionSchema = z.enum(["MANDATORY", "PREFERRED", "INFORMATIONAL"]);
const evaluationModeSchema = z.enum(["DETERMINISTIC", "EVIDENCE_MAPPING", "HUMAN_ONLY"]);
const ruleTemplateSchema = z.enum([
  "LICENSE_ATTESTATION",
  "CERTIFICATION_ATTESTATION",
  "WORK_AUTHORIZATION_ATTESTATION",
  "LEGAL_MINIMUM_AGE",
]);

const deterministicRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("license_held"), name: z.string().trim().min(1).max(160), state: z.string().trim().min(1).max(80).optional() }).strict(),
  z.object({ type: z.literal("credential_held"), name: z.string().trim().min(1).max(160) }).strict(),
  z.object({ type: z.literal("min_months_experience"), months: z.number().int().min(0).max(1_200), field: z.string().trim().min(1).max(160).optional() }).strict(),
  z.object({ type: z.literal("location_in"), states: z.array(z.string().trim().min(2).max(80)).min(1).max(60) }).strict(),
  z.object({ type: z.literal("shift_availability"), shifts: z.array(z.string().trim().min(1).max(80)).min(1).max(20) }).strict(),
  z.object({ type: z.literal("attestation"), questionKey: z.string().trim().min(1).max(160), expected: z.boolean() }).strict(),
]);

const criterionInputSchema = z.object({
  ordinal: z.number().int().positive().max(10_000).optional(),
  kind: criterionKindSchema,
  disposition: dispositionSchema,
  evaluationMode: evaluationModeSchema,
  label: z.string().trim().min(1).max(160),
  statement: z.string().trim().min(1).max(2_000),
  ruleTemplateId: ruleTemplateSchema.nullish(),
  deterministicRule: deterministicRuleSchema.nullish(),
  requiresHumanReview: z.boolean().optional(),
  autoEnforceable: z.boolean().optional(),
}).strict();

export type CriteriaSetStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";
export type CriterionAuthoringInput = z.input<typeof criterionInputSchema>;
export type CriterionPatchInput = Partial<CriterionAuthoringInput>;
export type AuthoredCriterion = {
  id: string;
  criteriaSetId: string;
  ordinal: number;
  kind: z.infer<typeof criterionKindSchema>;
  disposition: z.infer<typeof dispositionSchema>;
  evaluationMode: z.infer<typeof evaluationModeSchema>;
  label: string;
  statement: string;
  ruleTemplateId: z.infer<typeof ruleTemplateSchema> | null;
  deterministicRule: z.infer<typeof deterministicRuleSchema> | null;
  requiresHumanReview: boolean;
  autoEnforceable: boolean;
  createdAt: string;
};
export type AuthoredCriteriaSet = {
  id: string;
  jobId: string;
  version: number;
  status: CriteriaSetStatus;
  authoringState: "STRUCTURED" | "UNSTRUCTURED";
  publishedAt: string | null;
  publishedByUserId: string | null;
  supersededAt: string | null;
  supersededBySetId: string | null;
  createdAt: string;
  criteria: AuthoredCriterion[];
};

type SetRow = Omit<AuthoredCriteriaSet, "criteria"> & { job_id: string; authoring_state: "STRUCTURED" | "UNSTRUCTURED"; published_at: string | null; published_by_user_id: string | null; superseded_at: string | null; superseded_by_set_id: string | null; created_at: string };
type CriterionRow = {
  id: string;
  criteria_set_id: string;
  ordinal: number;
  kind: AuthoredCriterion["kind"];
  disposition: AuthoredCriterion["disposition"];
  evaluation_mode: AuthoredCriterion["evaluationMode"];
  label: string;
  statement: string;
  rule_template_id: AuthoredCriterion["ruleTemplateId"];
  deterministic_rule_json: string | null;
  requires_human_review: number;
  auto_enforceable: number;
  created_at: string;
};

export class CriteriaAuthoringError extends Error {
  constructor(
    public readonly code: "ACCESS_DENIED" | "NOT_FOUND" | "INVALID_STATE" | "INVALID_INPUT" | "PROHIBITED_CRITERION",
    message: string,
  ) {
    super(message);
    this.name = "CriteriaAuthoringError";
  }
}

function timestamp() {
  return new Date().toISOString();
}

async function activeActor(actor: EmployerActor) {
  const membership = await queryOne<{ id: string }>(
    `SELECT id FROM company_users
     WHERE id = ? AND company_id = ? AND user_id = ? AND revoked_at IS NULL
       AND role IN ('OWNER', 'ADMIN', 'RECRUITER')`,
    [actor.companyUserId, actor.companyId, actor.userId],
  );
  if (!membership) throw new CriteriaAuthoringError("ACCESS_DENIED", "An active organization membership is required.");
}

function mapCriterion(row: CriterionRow): AuthoredCriterion {
  let deterministicRule: AuthoredCriterion["deterministicRule"] = null;
  if (row.deterministic_rule_json) {
    const parsed = deterministicRuleSchema.safeParse(JSON.parse(row.deterministic_rule_json));
    if (!parsed.success) throw new CriteriaAuthoringError("INVALID_STATE", "A stored deterministic rule is invalid.");
    deterministicRule = parsed.data;
  }
  return {
    id: row.id,
    criteriaSetId: row.criteria_set_id,
    ordinal: Number(row.ordinal),
    kind: row.kind,
    disposition: row.disposition,
    evaluationMode: row.evaluation_mode,
    label: row.label,
    statement: row.statement,
    ruleTemplateId: row.rule_template_id,
    deterministicRule,
    requiresHumanReview: Number(row.requires_human_review) === 1,
    autoEnforceable: Number(row.auto_enforceable) === 1,
    createdAt: row.created_at,
  };
}

function mapSet(row: SetRow, criteria: AuthoredCriterion[]): AuthoredCriteriaSet {
  return {
    id: row.id,
    jobId: row.job_id,
    version: Number(row.version),
    status: row.status,
    authoringState: row.authoring_state,
    publishedAt: row.published_at,
    publishedByUserId: row.published_by_user_id,
    supersededAt: row.superseded_at,
    supersededBySetId: row.superseded_by_set_id,
    createdAt: row.created_at,
    criteria,
  };
}

async function criteriaForSet(criteriaSetId: string) {
  return (await query<CriterionRow>(
    `SELECT id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement,
            rule_template_id, deterministic_rule_json, requires_human_review, auto_enforceable, created_at
     FROM job_criteria WHERE criteria_set_id = ? ORDER BY ordinal ASC, created_at ASC`,
    [criteriaSetId],
  )).map(mapCriterion);
}

async function setForActor(actor: EmployerActor, criteriaSetId: string) {
  await activeActor(actor);
  const row = await queryOne<SetRow>(
    `SELECT criteria_set.id, criteria_set.job_id, criteria_set.version, criteria_set.status, criteria_set.authoring_state,
            criteria_set.published_at, criteria_set.published_by_user_id, criteria_set.superseded_at,
            criteria_set.superseded_by_set_id, criteria_set.created_at
     FROM job_criteria_sets criteria_set
     JOIN jobs job ON job.id = criteria_set.job_id
     WHERE criteria_set.id = ? AND job.company_id = ?`,
    [criteriaSetId, actor.companyId],
  );
  if (!row) throw new CriteriaAuthoringError("NOT_FOUND", "Criteria set not found for this organization.");
  return row;
}

async function draftSetForActor(actor: EmployerActor, criteriaSetId: string) {
  const set = await setForActor(actor, criteriaSetId);
  if (set.status !== "DRAFT") throw new CriteriaAuthoringError("INVALID_STATE", "Published criteria are immutable; create a revision instead.");
  return set;
}

function validateInput(input: unknown, existing?: AuthoredCriterion): Omit<AuthoredCriterion, "id" | "criteriaSetId" | "ordinal" | "createdAt"> & { ordinal?: number } {
  const supplied = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const merged = existing
    ? {
        ordinal: existing.ordinal,
        kind: existing.kind,
        disposition: existing.disposition,
        evaluationMode: existing.evaluationMode,
        label: existing.label,
        statement: existing.statement,
        ruleTemplateId: existing.ruleTemplateId,
        deterministicRule: existing.deterministicRule,
        requiresHumanReview: existing.requiresHumanReview,
        autoEnforceable: existing.autoEnforceable,
        ...supplied,
      }
    : input;
  const parsed = criterionInputSchema.safeParse(merged);
  if (!parsed.success) throw new CriteriaAuthoringError("INVALID_INPUT", "Criterion fields are incomplete or invalid.");
  const value = parsed.data;
  const prohibited = findProhibitedCriterion([value.label, value.statement, value.deterministicRule ? JSON.stringify(value.deterministicRule) : null]);
  if (prohibited) throw new CriteriaAuthoringError("PROHIBITED_CRITERION", `Criteria may not target ${prohibited.label}.`);

  const ruleTemplateId = value.ruleTemplateId ?? null;
  const deterministicRule = value.deterministicRule ?? null;
  const autoEnforceable = value.autoEnforceable === true;
  const requiresHumanReview = value.requiresHumanReview === true || value.kind === "HUMAN_JUDGMENT";
  if (
    ruleTemplateId !== "LEGAL_MINIMUM_AGE" &&
    /\b(age|years old|date of birth)\b/i.test([value.label, value.statement, deterministicRule ? JSON.stringify(deterministicRule) : ""].join("\n"))
  ) {
    throw new CriteriaAuthoringError("PROHIBITED_CRITERION", "Criteria may not target age outside the legal-minimum-age template.");
  }
  if (value.kind === "PREFERRED_QUALIFICATION" && value.disposition !== "PREFERRED") {
    throw new CriteriaAuthoringError("INVALID_INPUT", "Preferred qualifications must have a preferred disposition.");
  }
  if (value.kind === "HUMAN_JUDGMENT" && (value.evaluationMode !== "HUMAN_ONLY" || autoEnforceable || deterministicRule)) {
    throw new CriteriaAuthoringError("INVALID_INPUT", "Human-judgment criteria must be human-only and cannot be automatically enforced.");
  }
  if (value.evaluationMode !== "DETERMINISTIC" && deterministicRule) {
    throw new CriteriaAuthoringError("INVALID_INPUT", "Only deterministic criteria may define a deterministic rule.");
  }
  if (value.evaluationMode === "DETERMINISTIC" && !deterministicRule) {
    throw new CriteriaAuthoringError("INVALID_INPUT", "Deterministic criteria require a registered deterministic rule.");
  }
  if (autoEnforceable && (!ruleTemplateId || value.kind !== "HARD_ELIGIBILITY" || value.disposition !== "MANDATORY" || value.evaluationMode !== "DETERMINISTIC")) {
    throw new CriteriaAuthoringError("INVALID_INPUT", "Auto-enforcement is limited to mandatory deterministic hard-eligibility criteria with a registry template.");
  }
  if (!autoEnforceable && ruleTemplateId) {
    throw new CriteriaAuthoringError("INVALID_INPUT", "A registry template may only be used for auto-enforceable criteria.");
  }
  if (ruleTemplateId === "LEGAL_MINIMUM_AGE" && deterministicRule?.type !== "attestation") {
    throw new CriteriaAuthoringError("INVALID_INPUT", "The legal-minimum-age template requires an attestation rule.");
  }
  return {
    ordinal: value.ordinal,
    kind: value.kind,
    disposition: value.disposition,
    evaluationMode: value.evaluationMode,
    label: value.label,
    statement: value.statement,
    ruleTemplateId,
    deterministicRule,
    requiresHumanReview,
    autoEnforceable,
  };
}

async function assertRegisteredTemplate(templateId: string | null) {
  if (!templateId) return;
  const registered = await queryOne<{ id: string }>("SELECT id FROM auto_enforceable_rule_templates WHERE id = ?", [templateId]);
  if (!registered) throw new CriteriaAuthoringError("INVALID_INPUT", "The selected rule template is not registered.");
}

export async function listCriteriaForJob(actor: EmployerActor, jobId: string) {
  await activeActor(actor);
  const sets = await query<SetRow>(
    `SELECT criteria_set.id, criteria_set.job_id, criteria_set.version, criteria_set.status, criteria_set.authoring_state,
            criteria_set.published_at, criteria_set.published_by_user_id, criteria_set.superseded_at,
            criteria_set.superseded_by_set_id, criteria_set.created_at
     FROM job_criteria_sets criteria_set
     JOIN jobs job ON job.id = criteria_set.job_id
     WHERE criteria_set.job_id = ? AND job.company_id = ?
     ORDER BY criteria_set.version DESC`,
    [jobId, actor.companyId],
  );
  if (sets.length === 0) {
    const job = await queryOne<{ id: string }>("SELECT id FROM jobs WHERE id = ? AND company_id = ?", [jobId, actor.companyId]);
    if (!job) throw new CriteriaAuthoringError("NOT_FOUND", "Job not found for this organization.");
  }
  return Promise.all(sets.map(async (set) => mapSet(set, await criteriaForSet(set.id))));
}

export async function createCriterion(actor: EmployerActor, criteriaSetId: string, input: CriterionAuthoringInput) {
  return tx(async () => {
    const set = await draftSetForActor(actor, criteriaSetId);
    const value = validateInput(input);
    await assertRegisteredTemplate(value.ruleTemplateId);
    const nextOrdinal = await queryOne<{ next_ordinal: number }>(
      "SELECT COALESCE(MAX(ordinal), 0) + 1 AS next_ordinal FROM job_criteria WHERE criteria_set_id = ?",
      [set.id],
    );
    const ordinal = value.ordinal ?? Number(nextOrdinal?.next_ordinal ?? 1);
    const existingOrdinal = await queryOne<{ id: string }>("SELECT id FROM job_criteria WHERE criteria_set_id = ? AND ordinal = ?", [set.id, ordinal]);
    if (existingOrdinal) throw new CriteriaAuthoringError("INVALID_INPUT", "A criterion already uses that ordinal in this set.");
    const id = randomUUID();
    const createdAt = timestamp();
    await run(
      `INSERT INTO job_criteria (
         id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement,
         rule_template_id, deterministic_rule_json, requires_human_review, auto_enforceable, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, set.id, ordinal, value.kind, value.disposition, value.evaluationMode, value.label, value.statement,
        value.ruleTemplateId, value.deterministicRule ? JSON.stringify(value.deterministicRule) : null,
        value.requiresHumanReview ? 1 : 0, value.autoEnforceable ? 1 : 0, createdAt,
      ],
    );
    if (set.authoring_state === "UNSTRUCTURED") {
      await run("UPDATE job_criteria_sets SET authoring_state = 'STRUCTURED' WHERE id = ?", [set.id]);
    }
    return (await criteriaForSet(set.id)).find((criterion) => criterion.id === id)!;
  });
}

export async function updateCriterion(actor: EmployerActor, criteriaSetId: string, criterionId: string, input: CriterionPatchInput) {
  return tx(async () => {
    const set = await draftSetForActor(actor, criteriaSetId);
    const current = (await criteriaForSet(set.id)).find((criterion) => criterion.id === criterionId);
    if (!current) throw new CriteriaAuthoringError("NOT_FOUND", "Criterion not found in this criteria set.");
    const value = validateInput(input, current);
    await assertRegisteredTemplate(value.ruleTemplateId);
    const ordinal = value.ordinal ?? current.ordinal;
    const conflictingOrdinal = await queryOne<{ id: string }>(
      "SELECT id FROM job_criteria WHERE criteria_set_id = ? AND ordinal = ? AND id <> ?",
      [set.id, ordinal, current.id],
    );
    if (conflictingOrdinal) throw new CriteriaAuthoringError("INVALID_INPUT", "A criterion already uses that ordinal in this set.");
    await run(
      `UPDATE job_criteria
       SET ordinal = ?, kind = ?, disposition = ?, evaluation_mode = ?, label = ?, statement = ?,
           rule_template_id = ?, deterministic_rule_json = ?, requires_human_review = ?, auto_enforceable = ?
       WHERE id = ? AND criteria_set_id = ?`,
      [
        ordinal, value.kind, value.disposition, value.evaluationMode, value.label, value.statement,
        value.ruleTemplateId, value.deterministicRule ? JSON.stringify(value.deterministicRule) : null,
        value.requiresHumanReview ? 1 : 0, value.autoEnforceable ? 1 : 0, current.id, set.id,
      ],
    );
    return (await criteriaForSet(set.id)).find((criterion) => criterion.id === current.id)!;
  });
}

export async function deleteCriterion(actor: EmployerActor, criteriaSetId: string, criterionId: string) {
  return tx(async () => {
    const set = await draftSetForActor(actor, criteriaSetId);
    const result = await run("DELETE FROM job_criteria WHERE id = ? AND criteria_set_id = ?", [criterionId, set.id]);
    if (result.changes === 0) throw new CriteriaAuthoringError("NOT_FOUND", "Criterion not found in this criteria set.");
  });
}

export async function publishCriteriaSet(actor: EmployerActor, criteriaSetId: string) {
  return tx(async () => {
    const set = await draftSetForActor(actor, criteriaSetId);
    const criteria = await criteriaForSet(set.id);
    if (set.authoring_state === "STRUCTURED" && criteria.length === 0) {
      throw new CriteriaAuthoringError("INVALID_INPUT", "Structured criteria sets must contain at least one criterion before publication.");
    }
    const existingPublished = await queryOne<{ id: string }>(
      "SELECT id FROM job_criteria_sets WHERE job_id = ? AND status = 'PUBLISHED'",
      [set.job_id],
    );
    const publishedAt = timestamp();
    if (existingPublished) {
      await run(
        `UPDATE job_criteria_sets
         SET status = 'SUPERSEDED', superseded_at = ?, superseded_by_set_id = ?
         WHERE id = ?`,
        [publishedAt, set.id, existingPublished.id],
      );
    }
    await run(
      `UPDATE job_criteria_sets SET status = 'PUBLISHED', published_at = ?, published_by_user_id = ? WHERE id = ?`,
      [publishedAt, actor.userId, set.id],
    );
    return mapSet(await setForActor(actor, set.id), await criteriaForSet(set.id));
  });
}

export async function reviseCriteriaSet(actor: EmployerActor, criteriaSetId: string) {
  return tx(async () => {
    const current = await setForActor(actor, criteriaSetId);
    if (current.status !== "PUBLISHED") throw new CriteriaAuthoringError("INVALID_STATE", "Only a published criteria set can be revised.");
    const existingDraft = await queryOne<{ id: string }>("SELECT id FROM job_criteria_sets WHERE job_id = ? AND status = 'DRAFT'", [current.job_id]);
    if (existingDraft) throw new CriteriaAuthoringError("INVALID_STATE", "This job already has an editable criteria revision.");
    const nextVersion = await queryOne<{ next_version: number }>(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM job_criteria_sets WHERE job_id = ?",
      [current.job_id],
    );
    const version = Number(nextVersion?.next_version ?? current.version + 1);
    const id = randomUUID();
    const createdAt = timestamp();
    await run(
      `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
       VALUES (?, ?, ?, 'DRAFT', ?, ?)`,
      [id, current.job_id, version, current.authoring_state, createdAt],
    );
    for (const criterion of await criteriaForSet(current.id)) {
      await run(
        `INSERT INTO job_criteria (
           id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement,
           rule_template_id, deterministic_rule_json, requires_human_review, auto_enforceable, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), id, criterion.ordinal, criterion.kind, criterion.disposition, criterion.evaluationMode,
          criterion.label, criterion.statement, criterion.ruleTemplateId,
          criterion.deterministicRule ? JSON.stringify(criterion.deterministicRule) : null,
          criterion.requiresHumanReview ? 1 : 0, criterion.autoEnforceable ? 1 : 0, createdAt,
        ],
      );
    }
    return mapSet(await setForActor(actor, id), await criteriaForSet(id));
  });
}
