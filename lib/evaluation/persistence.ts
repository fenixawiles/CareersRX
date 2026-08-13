import "server-only";

import { randomUUID } from "node:crypto";
import { queryFile, queryOneFile, runFile, transactionFile } from "@/lib/db/sql";
import { assessmentAfterEvidence, verifyEvidence, type EvidenceCandidate } from "@/lib/evaluation/evidence-verify";
import { enqueueNotification } from "@/lib/notify/enqueue";

type FindingAssessment = "SATISFIED" | "NOT_SATISFIED" | "INSUFFICIENT_EVIDENCE" | "REQUIRES_HUMAN_JUDGMENT";
type FindingOrigin = "DETERMINISTIC_RULE" | "MODEL";
type EvaluationState = "COMPLETE" | "PARTIAL_DETERMINISTIC" | "FAILED";
type Decision = "ADVANCE" | "DO_NOT_ADVANCE" | "REQUEST_MORE_INFO";
type DecisionReason =
  | "MANDATORY_CRITERION_NOT_MET"
  | "EVIDENCE_INSUFFICIENT_AFTER_REVIEW"
  | "HUMAN_JUDGMENT_CRITERION_NOT_MET"
  | "STRONGER_CANDIDATE_POOL"
  | "POSITION_CLOSED"
  | "ROLE_FILLED"
  | "BUSINESS_NEED_CHANGED"
  | "APPLICANT_UNRESPONSIVE";

export class EvaluationPersistenceError extends Error {
  constructor(
    public readonly code:
      | "ACCESS_DENIED"
      | "NOT_FOUND"
      | "NOT_EVALUABLE"
      | "INVALID_STATE"
      | "INVALID_INPUT"
      | "UNGROUNDED_DECISION",
    message: string,
  ) {
    super(message);
    this.name = "EvaluationPersistenceError";
  }
}

export type EmployerActor = {
  companyId: string;
  companyUserId: string;
  userId: string;
};

export type StartEvaluationInput = {
  applicationId: string;
  evaluator: "SYSTEM" | "MODEL";
  modelName?: string;
  modelVersion?: string;
  promptVersion?: string;
  schemaVersion?: string;
};

export type EvaluationFindingInput = {
  criterionId: string;
  origin: FindingOrigin;
  assessment: FindingAssessment;
  confidence?: number;
  reasonCode:
    | "NO_MATCHING_CONTENT"
    | "CONTENT_AMBIGUOUS"
    | "EVIDENCE_CONTRADICTED"
    | "REQUIRES_CREDENTIAL_CHECK"
    | "REQUIRES_HUMAN_INTERPRETATION"
    | "RULE_COMPARISON";
  reasoningNote?: string;
  evidenceSource: "SELF_REPORTED" | "RESUME_STATED" | "VERIFIED";
  evidence?: EvidenceCandidate[];
};

type ApplicationRow = {
  id: string;
  company_id: string;
  seeker_user_id: string;
  criteria_set_id: string;
  evaluation_state: string;
  disposition_state: string;
  current_decision_id: string | null;
  profile_snapshot_json: string;
  resume_snapshot_json: string;
  job_id: string;
};

type EvaluationRow = {
  id: string;
  application_id: string;
  criteria_set_id: string;
  state: string;
  locked_by_decision_id: string | null;
};

type CriterionRow = {
  id: string;
  kind: string;
  disposition: string;
  label: string;
  statement: string;
  rule_template_id: "LICENSE_ATTESTATION" | "CERTIFICATION_ATTESTATION" | "WORK_AUTHORIZATION_ATTESTATION" | "LEGAL_MINIMUM_AGE" | null;
  requires_human_review: number;
  auto_enforceable: number;
};

function timestamp() {
  return new Date().toISOString();
}

function audit(
  dbPath: string,
  input: { eventType: string; entityType: string; entityId: string; companyId: string; actorUserId: string; metadata: Record<string, unknown> },
) {
  runFile(
    dbPath,
    `INSERT INTO audit_events (id, event_type, actor_kind, actor_user_id, entity_type, entity_id, company_id, metadata_json, created_at)
     VALUES (?, ?, 'HUMAN', ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.eventType, input.actorUserId, input.entityType, input.entityId, input.companyId, JSON.stringify(input.metadata), timestamp()],
  );
}

function activeActor(dbPath: string, actor: EmployerActor) {
  const membership = queryOneFile<{ id: string }>(
    dbPath,
    `SELECT id FROM local_company_users
     WHERE id = ? AND company_id = ? AND user_id = ? AND revoked_at IS NULL`,
    [actor.companyUserId, actor.companyId, actor.userId],
  );
  if (!membership) throw new EvaluationPersistenceError("ACCESS_DENIED", "An active organization membership is required.");
}

function applicationForActor(dbPath: string, actor: EmployerActor, applicationId: string): ApplicationRow {
  activeActor(dbPath, actor);
  const application = queryOneFile<ApplicationRow>(
    dbPath,
    `SELECT application.id, job.company_id, application.seeker_user_id, application.criteria_set_id, application.evaluation_state,
            application.disposition_state, application.current_decision_id, application.profile_snapshot_json,
            application.resume_snapshot_json, application.job_id
     FROM local_applications application
     JOIN local_jobs job ON job.id = application.job_id
     WHERE application.id = ? AND job.company_id = ?`,
    [applicationId, actor.companyId],
  );
  if (!application) throw new EvaluationPersistenceError("NOT_FOUND", "Application not found for this organization.");
  return application;
}

function evaluationForActor(dbPath: string, actor: EmployerActor, evaluationId: string): EvaluationRow {
  activeActor(dbPath, actor);
  const evaluation = queryOneFile<EvaluationRow>(
    dbPath,
    `SELECT evaluation.id, evaluation.application_id, evaluation.criteria_set_id, evaluation.state, evaluation.locked_by_decision_id
     FROM application_evaluations evaluation
     JOIN local_applications application ON application.id = evaluation.application_id
     JOIN local_jobs job ON job.id = application.job_id
     WHERE evaluation.id = ? AND job.company_id = ?`,
    [evaluationId, actor.companyId],
  );
  if (!evaluation) throw new EvaluationPersistenceError("NOT_FOUND", "Evaluation not found for this organization.");
  return evaluation;
}

function criteriaForEvaluation(dbPath: string, evaluation: EvaluationRow, criterionIds: string[]) {
  if (criterionIds.length === 0) return new Map<string, CriterionRow>();
  const placeholders = criterionIds.map(() => "?").join(", ");
  const rows = queryFile<CriterionRow>(
    dbPath,
    `SELECT id, kind, disposition, label, statement, rule_template_id, requires_human_review, auto_enforceable
     FROM job_criteria WHERE criteria_set_id = ? AND id IN (${placeholders})`,
    [evaluation.criteria_set_id, ...criterionIds],
  );
  if (rows.length !== criterionIds.length) {
    throw new EvaluationPersistenceError("INVALID_INPUT", "Every finding must cite a criterion in the locked criteria set.");
  }
  return new Map(rows.map((criterion) => [criterion.id, criterion]));
}

function parseSnapshot(application: ApplicationRow) {
  try {
    return {
      profile: JSON.parse(application.profile_snapshot_json) as Record<string, unknown>,
      resume: JSON.parse(application.resume_snapshot_json) as Record<string, unknown>,
    };
  } catch {
    throw new EvaluationPersistenceError("INVALID_STATE", "The immutable application snapshot cannot be read.");
  }
}

export function startEvaluationRun(dbPath: string, actor: EmployerActor, input: StartEvaluationInput) {
  return transactionFile(dbPath, () => {
    const application = applicationForActor(dbPath, actor, input.applicationId);
    const criteriaSet = queryOneFile<{ status: string; authoring_state: string }>(
      dbPath,
      "SELECT status, authoring_state FROM job_criteria_sets WHERE id = ?",
      [application.criteria_set_id],
    );
    if (!criteriaSet || criteriaSet.status !== "PUBLISHED" || criteriaSet.authoring_state !== "STRUCTURED") {
      throw new EvaluationPersistenceError("NOT_EVALUABLE", "This application is locked to an unstructured or unpublished criteria set.");
    }
    if (!["NOT_STARTED", "FAILED"].includes(application.evaluation_state)) {
      throw new EvaluationPersistenceError("INVALID_STATE", "This application cannot start another evaluation in its current state.");
    }
    const openRun = queryOneFile<{ id: string }>(
      dbPath,
      "SELECT id FROM application_evaluations WHERE application_id = ? AND state = 'IN_PROGRESS'",
      [application.id],
    );
    if (openRun) throw new EvaluationPersistenceError("INVALID_STATE", "An evaluation is already in progress for this application.");

    const runNumber = Number(
      queryOneFile<{ run_number: number }>(
        dbPath,
        "SELECT COALESCE(MAX(run_number), 0) + 1 AS run_number FROM application_evaluations WHERE application_id = ?",
        [application.id],
      )?.run_number ?? 1,
    );
    const id = randomUUID();
    const startedAt = timestamp();
    runFile(
      dbPath,
      `INSERT INTO application_evaluations (
        id, application_id, criteria_set_id, run_number, state, evaluator_kind, model_name, model_version,
        prompt_version, schema_version, started_at
      ) VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        application.id,
        application.criteria_set_id,
        runNumber,
        input.evaluator,
        input.modelName ?? null,
        input.modelVersion ?? null,
        input.promptVersion ?? null,
        input.schemaVersion ?? null,
        startedAt,
      ],
    );
    runFile(dbPath, "UPDATE local_applications SET evaluation_state = 'IN_PROGRESS', updated_at = ? WHERE id = ?", [startedAt, application.id]);
    audit(dbPath, {
      eventType: "EVALUATION_STARTED",
      entityType: "APPLICATION_EVALUATION",
      entityId: id,
      companyId: actor.companyId,
      actorUserId: actor.userId,
      metadata: { applicationId: application.id, criteriaSetId: application.criteria_set_id, runNumber, evaluator: input.evaluator },
    });
    return { id, runNumber, criteriaSetId: application.criteria_set_id };
  });
}

export function recordEvaluationFindings(
  dbPath: string,
  actor: EmployerActor,
  evaluationId: string,
  inputs: EvaluationFindingInput[],
) {
  return transactionFile(dbPath, () => {
    const evaluation = evaluationForActor(dbPath, actor, evaluationId);
    if (evaluation.state !== "IN_PROGRESS" || evaluation.locked_by_decision_id) {
      throw new EvaluationPersistenceError("INVALID_STATE", "Findings can only be added to an unlocked in-progress evaluation.");
    }
    const application = applicationForActor(dbPath, actor, evaluation.application_id);
    const ids = inputs.map((input) => input.criterionId);
    if (new Set(ids).size !== ids.length) {
      throw new EvaluationPersistenceError("INVALID_INPUT", "Only one finding may be recorded per criterion in an evaluation run.");
    }
    const criteria = criteriaForEvaluation(dbPath, evaluation, ids);
    const snapshot = parseSnapshot(application);
    const findingIds: string[] = [];

    for (const input of inputs) {
      const criterion = criteria.get(input.criterionId)!;
      if (input.confidence !== undefined && (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1)) {
        throw new EvaluationPersistenceError("INVALID_INPUT", "Finding confidence must be between 0 and 1.");
      }
      if (criterion.kind === "HUMAN_JUDGMENT" && input.assessment !== "REQUIRES_HUMAN_JUDGMENT") {
        throw new EvaluationPersistenceError("INVALID_INPUT", "Human-judgment criteria must remain flagged for human judgment.");
      }
      if (Number(criterion.auto_enforceable) === 1 && input.origin !== "DETERMINISTIC_RULE") {
        throw new EvaluationPersistenceError("INVALID_INPUT", "Auto-enforceable criteria must be assessed by a deterministic rule.");
      }
      if (input.origin === "MODEL" && input.assessment === "NOT_SATISFIED") {
        throw new EvaluationPersistenceError("INVALID_INPUT", "A model cannot record an applicant deficiency.");
      }

      const verifiedEvidence = (input.evidence ?? [])
        .map((candidate) => verifyEvidence(snapshot, candidate, { ruleTemplateId: criterion.rule_template_id ?? undefined }))
        .filter((evidence): evidence is NonNullable<typeof evidence> => evidence !== null);
      const assessment =
        input.origin === "MODEL" && input.assessment !== "NOT_SATISFIED"
          ? assessmentAfterEvidence(input.assessment, verifiedEvidence)
          : input.assessment;
      const findingId = randomUUID();
      const createdAt = timestamp();
      runFile(
        dbPath,
        `INSERT INTO criterion_findings (
          id, evaluation_id, criterion_id, criterion_statement_snapshot, criterion_kind_snapshot,
          criterion_disposition_snapshot, finding_origin, assessment_state, confidence, reason_code,
          reasoning_note, requires_human_review, evidence_source_kind, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          findingId,
          evaluation.id,
          criterion.id,
          criterion.statement,
          criterion.kind,
          criterion.disposition,
          input.origin,
          assessment,
          input.confidence ?? null,
          input.reasonCode,
          input.reasoningNote ?? null,
          Number(criterion.requires_human_review) === 1 || assessment === "REQUIRES_HUMAN_JUDGMENT" ? 1 : 0,
          input.evidenceSource,
          createdAt,
        ],
      );
      for (const evidence of verifiedEvidence) {
        runFile(
          dbPath,
          `INSERT INTO criterion_evidence (id, finding_id, snapshot_field, excerpt, char_start, char_end, claim_polarity, claim_type, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            findingId,
            evidence.snapshotField,
            evidence.excerpt,
            evidence.charStart,
            evidence.charEnd,
            evidence.claimPolarity,
            "APPLICATION_SNAPSHOT",
            null,
          ],
        );
        if (evidence.protectedContentAdmittedUnderTemplate) {
          audit(dbPath, {
            eventType: "PROTECTED_EVIDENCE_ADMITTED_UNDER_TEMPLATE",
            entityType: "CRITERION_EVIDENCE",
            entityId: findingId,
            companyId: actor.companyId,
            actorUserId: actor.userId,
            metadata: { applicationId: application.id, criterionId: criterion.id, ruleTemplateId: criterion.rule_template_id },
          });
        }
      }
      findingIds.push(findingId);
    }
    return { findingIds };
  });
}

export function completeEvaluationRun(
  dbPath: string,
  actor: EmployerActor,
  input: { evaluationId: string; state: EvaluationState; errorCode?: string; errorDetail?: string },
) {
  return transactionFile(dbPath, () => {
    const evaluation = evaluationForActor(dbPath, actor, input.evaluationId);
    if (evaluation.state !== "IN_PROGRESS" || evaluation.locked_by_decision_id) {
      throw new EvaluationPersistenceError("INVALID_STATE", "Only an unlocked in-progress evaluation can be finalized.");
    }
    if (input.state === "FAILED" && !input.errorCode) {
      throw new EvaluationPersistenceError("INVALID_INPUT", "A failed evaluation must record an error code.");
    }
    const completedAt = timestamp();
    runFile(
      dbPath,
      "UPDATE application_evaluations SET state = ?, completed_at = ?, error_code = ?, error_detail = ? WHERE id = ?",
      [input.state, completedAt, input.errorCode ?? null, input.errorDetail ?? null, evaluation.id],
    );
    runFile(
      dbPath,
      "UPDATE local_applications SET evaluation_state = ?, updated_at = ? WHERE id = ?",
      [input.state, completedAt, evaluation.application_id],
    );
    audit(dbPath, {
      eventType: "EVALUATION_FINALIZED",
      entityType: "APPLICATION_EVALUATION",
      entityId: evaluation.id,
      companyId: actor.companyId,
      actorUserId: actor.userId,
      metadata: { applicationId: evaluation.application_id, state: input.state, errorCode: input.errorCode ?? null },
    });
    return { id: evaluation.id, state: input.state };
  });
}

function assertDecisionGrounding(
  dbPath: string,
  input: { application: ApplicationRow; evaluation: EvaluationRow | null; reason: DecisionReason; findingIds: string[]; humanAssessmentIds: string[]; hiringRoundId?: string },
) {
  if (input.reason === "MANDATORY_CRITERION_NOT_MET") {
    const supported = input.findingIds.length
      ? queryOneFile<{ count: number }>(
          dbPath,
          `SELECT COUNT(*) AS count FROM criterion_findings
           WHERE id IN (${input.findingIds.map(() => "?").join(", ")})
             AND evaluation_id = ? AND assessment_state = 'NOT_SATISFIED'
             AND finding_origin = 'DETERMINISTIC_RULE' AND criterion_disposition_snapshot = 'MANDATORY'`,
          [...input.findingIds, input.evaluation?.id ?? ""],
        )
      : null;
    if (Number(supported?.count ?? 0) < 1) throw new EvaluationPersistenceError("UNGROUNDED_DECISION", "A mandatory deficiency decision requires a cited deterministic mandatory finding.");
  }
  if (input.reason === "EVIDENCE_INSUFFICIENT_AFTER_REVIEW") {
    const insufficient = input.findingIds.length
      ? queryOneFile<{ count: number }>(
          dbPath,
          `SELECT COUNT(*) AS count FROM criterion_findings
           WHERE id IN (${input.findingIds.map(() => "?").join(", ")})
             AND evaluation_id = ? AND assessment_state = 'INSUFFICIENT_EVIDENCE'
             AND criterion_disposition_snapshot = 'MANDATORY'`,
          [...input.findingIds, input.evaluation?.id ?? ""],
        )
      : null;
    const reviewed = input.humanAssessmentIds.length
      ? queryOneFile<{ count: number }>(
          dbPath,
          `SELECT COUNT(*) AS count FROM human_assessments
           WHERE id IN (${input.humanAssessmentIds.map(() => "?").join(", ")})
             AND application_id = ? AND evaluation_id = ? AND assessment = 'CANNOT_DETERMINE'`,
          [...input.humanAssessmentIds, input.application.id, input.evaluation?.id ?? ""],
        )
      : null;
    if (Number(insufficient?.count ?? 0) < 1 || Number(reviewed?.count ?? 0) < 1) {
      throw new EvaluationPersistenceError("UNGROUNDED_DECISION", "An evidence-insufficient decision requires a cited mandatory finding and a cited human review that could not determine it.");
    }
  }
  if (input.reason === "HUMAN_JUDGMENT_CRITERION_NOT_MET") {
    const supported = input.humanAssessmentIds.length
      ? queryOneFile<{ count: number }>(
          dbPath,
          `SELECT COUNT(*) AS count FROM human_assessments assessment
           JOIN job_criteria criterion ON criterion.id = assessment.criterion_id
           WHERE assessment.id IN (${input.humanAssessmentIds.map(() => "?").join(", ")})
             AND assessment.application_id = ? AND assessment.evaluation_id = ?
             AND assessment.assessment = 'NOT_SATISFIED' AND criterion.kind = 'HUMAN_JUDGMENT'
             AND criterion.disposition = 'MANDATORY'
             AND (assessment.review_source_id IS NOT NULL OR EXISTS (
               SELECT 1 FROM human_assessment_evidence evidence WHERE evidence.assessment_id = assessment.id
             ))`,
          [...input.humanAssessmentIds, input.application.id, input.evaluation?.id ?? ""],
        )
      : null;
    if (Number(supported?.count ?? 0) < 1) throw new EvaluationPersistenceError("UNGROUNDED_DECISION", "A human-judgment decision requires a cited, evidenced human assessment.");
  }
  if (input.reason === "STRONGER_CANDIDATE_POOL") {
    const round = input.hiringRoundId
      ? queryOneFile<{ id: string }>(
          dbPath,
          "SELECT id FROM hiring_rounds WHERE id = ? AND job_id = ? AND criteria_set_id = ?",
          [input.hiringRoundId, input.application.job_id, input.application.criteria_set_id],
        )
      : null;
    if (!round) throw new EvaluationPersistenceError("UNGROUNDED_DECISION", "A candidate-pool decision requires a hiring round for this job and criteria version.");
  }
}

export function recordEmployerDecision(
  dbPath: string,
  actor: EmployerActor,
  input: {
    applicationId: string;
    evaluationId?: string;
    decision: Decision;
    reasonCategory?: DecisionReason;
    findingIds?: string[];
    humanAssessmentIds?: string[];
    hiringRoundId?: string;
    internalNote?: string;
    supersedesDecisionId?: string;
  },
) {
  return transactionFile(dbPath, () => {
    const application = applicationForActor(dbPath, actor, input.applicationId);
    if (input.decision === "DO_NOT_ADVANCE" && !input.reasonCategory) {
      throw new EvaluationPersistenceError("INVALID_INPUT", "A do-not-advance decision requires a reason category.");
    }
    if (input.decision !== "DO_NOT_ADVANCE" && input.reasonCategory) {
      throw new EvaluationPersistenceError("INVALID_INPUT", "Only a do-not-advance decision may include a reason category.");
    }
    if (application.current_decision_id !== (input.supersedesDecisionId ?? null)) {
      throw new EvaluationPersistenceError("INVALID_STATE", "A new decision must explicitly supersede the current decision, if any.");
    }
    const groundingReasons = new Set<DecisionReason>([
      "MANDATORY_CRITERION_NOT_MET",
      "EVIDENCE_INSUFFICIENT_AFTER_REVIEW",
      "HUMAN_JUDGMENT_CRITERION_NOT_MET",
    ]);
    const evaluation = input.evaluationId ? evaluationForActor(dbPath, actor, input.evaluationId) : null;
    if (evaluation && evaluation.application_id !== application.id) {
      throw new EvaluationPersistenceError("INVALID_INPUT", "The decision evaluation must belong to the application.");
    }
    if (input.reasonCategory && groundingReasons.has(input.reasonCategory)) {
      if (!evaluation || !["COMPLETE", "PARTIAL_DETERMINISTIC"].includes(evaluation.state)) {
        throw new EvaluationPersistenceError("UNGROUNDED_DECISION", "This decision requires a finalized evaluation for the application.");
      }
    }

    const findingIds = input.findingIds ?? [];
    const humanAssessmentIds = input.humanAssessmentIds ?? [];
    if (new Set(findingIds).size !== findingIds.length || new Set(humanAssessmentIds).size !== humanAssessmentIds.length) {
      throw new EvaluationPersistenceError("INVALID_INPUT", "Decision citations cannot contain duplicates.");
    }
    if (input.reasonCategory) {
      assertDecisionGrounding(dbPath, {
        application,
        evaluation,
        reason: input.reasonCategory,
        findingIds,
        humanAssessmentIds,
        hiringRoundId: input.hiringRoundId,
      });
    }

    const id = randomUUID();
    const createdAt = timestamp();
    runFile(
      dbPath,
      `INSERT INTO employer_decisions (
        id, application_id, evaluation_id, criteria_set_id, hiring_round_id, decision, reason_category,
        internal_note, supersedes_decision_id, actor_user_id, actor_company_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        application.id,
        evaluation?.id ?? null,
        application.criteria_set_id,
        input.hiringRoundId ?? null,
        input.decision,
        input.reasonCategory ?? null,
        input.internalNote ?? null,
        input.supersedesDecisionId ?? null,
        actor.userId,
        actor.companyUserId,
        createdAt,
      ],
    );
    for (const findingId of findingIds) {
      runFile(dbPath, "INSERT INTO employer_decision_findings (decision_id, finding_id) VALUES (?, ?)", [id, findingId]);
    }
    for (const assessmentId of humanAssessmentIds) {
      runFile(dbPath, "INSERT INTO employer_decision_human_assessments (decision_id, assessment_id) VALUES (?, ?)", [id, assessmentId]);
    }
    if (evaluation && !evaluation.locked_by_decision_id) {
      runFile(dbPath, "UPDATE application_evaluations SET locked_by_decision_id = ? WHERE id = ?", [id, evaluation.id]);
    }
    const disposition =
      input.decision === "ADVANCE" ? "ADVANCED" : input.decision === "DO_NOT_ADVANCE" ? "NOT_ADVANCED" : "NEEDS_HUMAN_REVIEW";
    runFile(
      dbPath,
      "UPDATE local_applications SET current_decision_id = ?, disposition_state = ?, status = 'REVIEWED', updated_at = ? WHERE id = ?",
      [id, disposition, createdAt, application.id],
    );
    const { notificationId } = enqueueNotification(dbPath, {
      recipientUserId: application.seeker_user_id,
      applicationId: application.id,
      type: "DECISION_AVAILABLE",
      payload: { decisionId: id, applicationId: application.id },
    });
    runFile(
      dbPath,
      `INSERT INTO application_transitions (id, application_id, from_state, to_state, actor_kind, actor_user_id, rule_criterion_id, rationale, created_at)
       VALUES (?, ?, ?, ?, 'HUMAN', ?, NULL, ?, ?)`,
      [randomUUID(), application.id, application.disposition_state, disposition, actor.userId, "Employer decision recorded", createdAt],
    );
    audit(dbPath, {
      eventType: "EMPLOYER_DECISION_RECORDED",
      entityType: "EMPLOYER_DECISION",
      entityId: id,
      companyId: actor.companyId,
      actorUserId: actor.userId,
      metadata: {
        applicationId: application.id,
        evaluationId: evaluation?.id ?? null,
        decision: input.decision,
        reasonCategory: input.reasonCategory ?? null,
        notificationId,
      },
    });
    return { id, disposition };
  });
}
