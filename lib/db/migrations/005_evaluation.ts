import type { Migration } from "@/lib/db/migrate";
import { forbid } from "@/lib/db/migrations/util";

export const evaluationMigration: Migration = {
  version: 5,
  name: "evaluation",
  checksum: "sha256:pg-evaluation-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE application_evaluations (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        run_number INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('IN_PROGRESS', 'COMPLETE', 'PARTIAL_DETERMINISTIC', 'FAILED', 'NOT_APPLICABLE')),
        evaluator_kind TEXT NOT NULL CHECK (evaluator_kind IN ('SYSTEM', 'MODEL')),
        model_name TEXT,
        model_version TEXT,
        prompt_version TEXT,
        schema_version TEXT,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error_code TEXT,
        error_detail TEXT,
        locked_by_decision_id TEXT,
        UNIQUE(application_id, run_number)
      );

      CREATE TABLE criterion_findings (
        id TEXT PRIMARY KEY,
        evaluation_id TEXT NOT NULL REFERENCES application_evaluations(id),
        criterion_id TEXT NOT NULL REFERENCES job_criteria(id),
        criterion_statement_snapshot TEXT NOT NULL,
        criterion_kind_snapshot TEXT NOT NULL,
        criterion_disposition_snapshot TEXT NOT NULL,
        finding_origin TEXT NOT NULL CHECK (finding_origin IN ('DETERMINISTIC_RULE', 'MODEL')),
        assessment_state TEXT NOT NULL CHECK (assessment_state IN ('SATISFIED', 'NOT_SATISFIED', 'INSUFFICIENT_EVIDENCE', 'REQUIRES_HUMAN_JUDGMENT')),
        confidence REAL,
        reason_code TEXT NOT NULL CHECK (reason_code IN ('NO_MATCHING_CONTENT', 'CONTENT_AMBIGUOUS', 'EVIDENCE_CONTRADICTED', 'REQUIRES_CREDENTIAL_CHECK', 'REQUIRES_HUMAN_INTERPRETATION', 'RULE_COMPARISON')),
        reasoning_note TEXT,
        requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
        evidence_source_kind TEXT NOT NULL CHECK (evidence_source_kind IN ('SELF_REPORTED', 'RESUME_STATED', 'VERIFIED')),
        created_at TIMESTAMPTZ NOT NULL,
        CHECK (assessment_state <> 'NOT_SATISFIED' OR finding_origin = 'DETERMINISTIC_RULE'),
        CHECK (criterion_kind_snapshot <> 'HUMAN_JUDGMENT' OR assessment_state = 'REQUIRES_HUMAN_JUDGMENT'),
        CHECK (NOT (finding_origin = 'MODEL' AND criterion_kind_snapshot = 'HARD_ELIGIBILITY' AND assessment_state = 'SATISFIED'))
      );
      CREATE UNIQUE INDEX criterion_findings_evaluation_criterion_unique
        ON criterion_findings(evaluation_id, criterion_id);

      CREATE TABLE criterion_evidence (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES criterion_findings(id),
        snapshot_field TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        char_start INTEGER NOT NULL CHECK (char_start >= 0),
        char_end INTEGER NOT NULL CHECK (char_end >= char_start),
        claim_polarity TEXT NOT NULL CHECK (claim_polarity IN ('SUPPORTS', 'CONTRADICTS', 'AMBIGUOUS')),
        claim_type TEXT NOT NULL,
        note TEXT
      );

      CREATE TABLE review_sources (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        kind TEXT NOT NULL CHECK (kind IN ('PHONE_SCREEN', 'INTERVIEW', 'WORK_SAMPLE', 'REFERENCE_CHECK', 'DOCUMENT_REVIEW')),
        occurred_at TIMESTAMPTZ NOT NULL,
        participants TEXT NOT NULL,
        summary TEXT,
        recorded_by_user_id TEXT NOT NULL REFERENCES users(id)
      );

      CREATE TABLE human_assessments (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        evaluation_id TEXT NOT NULL REFERENCES application_evaluations(id),
        criterion_id TEXT NOT NULL REFERENCES job_criteria(id),
        assessment TEXT NOT NULL CHECK (assessment IN ('SATISFIED', 'NOT_SATISFIED', 'CANNOT_DETERMINE')),
        review_source_id TEXT REFERENCES review_sources(id),
        note TEXT,
        assessor_user_id TEXT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE human_assessment_evidence (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES human_assessments(id),
        snapshot_field TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        claim_polarity TEXT NOT NULL CHECK (claim_polarity IN ('SUPPORTS', 'CONTRADICTS', 'AMBIGUOUS'))
      );

      CREATE TABLE hiring_rounds (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        label TEXT NOT NULL,
        opened_at TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ,
        filled_by_application_id TEXT REFERENCES applications(id),
        closure_reason TEXT,
        opened_by_user_id TEXT NOT NULL REFERENCES users(id)
      );

      CREATE TABLE contact_requests (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        channel TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL,
        response_window_days INTEGER NOT NULL CHECK (response_window_days > 0),
        responded_at TIMESTAMPTZ,
        recorded_by_user_id TEXT NOT NULL REFERENCES users(id)
      );

      CREATE TABLE employer_decisions (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        evaluation_id TEXT REFERENCES application_evaluations(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        hiring_round_id TEXT REFERENCES hiring_rounds(id),
        decision TEXT NOT NULL CHECK (decision IN ('ADVANCE', 'DO_NOT_ADVANCE', 'REQUEST_MORE_INFO')),
        reason_category TEXT CHECK (reason_category IN ('MANDATORY_CRITERION_NOT_MET', 'EVIDENCE_INSUFFICIENT_AFTER_REVIEW', 'HUMAN_JUDGMENT_CRITERION_NOT_MET', 'STRONGER_CANDIDATE_POOL', 'POSITION_CLOSED', 'ROLE_FILLED', 'BUSINESS_NEED_CHANGED', 'APPLICANT_UNRESPONSIVE')),
        internal_note TEXT,
        supersedes_decision_id TEXT REFERENCES employer_decisions(id),
        actor_user_id TEXT NOT NULL REFERENCES users(id),
        actor_company_user_id TEXT NOT NULL REFERENCES company_users(id),
        created_at TIMESTAMPTZ NOT NULL,
        CHECK (decision <> 'DO_NOT_ADVANCE' OR reason_category IS NOT NULL),
        CHECK (reason_category NOT IN ('MANDATORY_CRITERION_NOT_MET', 'EVIDENCE_INSUFFICIENT_AFTER_REVIEW', 'HUMAN_JUDGMENT_CRITERION_NOT_MET') OR evaluation_id IS NOT NULL),
        CHECK (reason_category <> 'STRONGER_CANDIDATE_POOL' OR hiring_round_id IS NOT NULL)
      );

      CREATE TABLE employer_decision_findings (
        decision_id TEXT NOT NULL REFERENCES employer_decisions(id),
        finding_id TEXT NOT NULL REFERENCES criterion_findings(id),
        PRIMARY KEY (decision_id, finding_id)
      );
      CREATE TABLE employer_decision_human_assessments (
        decision_id TEXT NOT NULL REFERENCES employer_decisions(id),
        assessment_id TEXT NOT NULL REFERENCES human_assessments(id),
        PRIMARY KEY (decision_id, assessment_id)
      );

      CREATE TABLE applicant_explanations (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        evaluation_id TEXT NOT NULL REFERENCES application_evaluations(id),
        decision_id TEXT REFERENCES employer_decisions(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        applicant_user_id TEXT REFERENCES users(id),
        company_id TEXT REFERENCES companies(id),
        body_json JSONB NOT NULL,
        rendered_text TEXT NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL,
        released_at TIMESTAMPTZ,
        released_by_user_id TEXT REFERENCES users(id),
        superseded_at TIMESTAMPTZ
      );
      CREATE UNIQUE INDEX applicant_explanations_one_per_decision
        ON applicant_explanations(decision_id) WHERE decision_id IS NOT NULL;
      CREATE INDEX applicant_explanations_applicant_released_idx
        ON applicant_explanations(applicant_user_id, released_at DESC);
      CREATE INDEX applicant_explanations_company_released_idx
        ON applicant_explanations(company_id, released_at DESC);

      CREATE TABLE evaluation_jobs (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        state TEXT NOT NULL CHECK (state IN ('PENDING', 'CLAIMED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTERED')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        claimed_by TEXT,
        claimed_at TIMESTAMPTZ,
        lease_expires_at TIMESTAMPTZ,
        next_attempt_at TIMESTAMPTZ NOT NULL,
        last_error_code TEXT,
        last_error_detail TEXT,
        dead_lettered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    // ── Evaluation lifecycle integrity ────────────────────────────────────────
    await client.exec(forbid({
      name: "evaluation_matches_structured_application",
      table: "application_evaluations",
      operation: "INSERT",
      when: `NOT EXISTS (
        SELECT 1
        FROM applications application
        JOIN job_criteria_sets criteria_set ON criteria_set.id = application.criteria_set_id
        WHERE application.id = NEW.application_id
          AND application.criteria_set_id = NEW.criteria_set_id
          AND criteria_set.status = 'PUBLISHED'
          AND criteria_set.authoring_state = 'STRUCTURED'
      )`,
      message: "evaluation must use the application locked structured criteria set",
    }));
    await client.exec(forbid({
      name: "criterion_findings_no_write_when_locked",
      table: "criterion_findings",
      operation: "INSERT",
      when: "(SELECT locked_by_decision_id FROM application_evaluations WHERE id = NEW.evaluation_id) IS NOT NULL",
      message: "locked evaluation cannot receive findings",
    }));
    await client.exec(forbid({
      name: "criterion_finding_matches_evaluation_criteria",
      table: "criterion_findings",
      operation: "INSERT",
      when: `NOT EXISTS (
        SELECT 1
        FROM application_evaluations evaluation
        JOIN job_criteria criterion ON criterion.criteria_set_id = evaluation.criteria_set_id
        WHERE evaluation.id = NEW.evaluation_id AND criterion.id = NEW.criterion_id
      )`,
      message: "criterion does not belong to evaluation criteria set",
    }));
    await client.exec(forbid({
      name: "criterion_finding_only_during_active_run",
      table: "criterion_findings",
      operation: "INSERT",
      when: "(SELECT state FROM application_evaluations WHERE id = NEW.evaluation_id) <> 'IN_PROGRESS'",
      message: "findings can only be added to an in-progress evaluation",
    }));
    await client.exec(forbid({
      name: "human_assessment_matches_evaluation",
      table: "human_assessments",
      operation: "INSERT",
      when: `NOT EXISTS (
        SELECT 1
        FROM application_evaluations evaluation
        JOIN job_criteria criterion ON criterion.criteria_set_id = evaluation.criteria_set_id
        WHERE evaluation.id = NEW.evaluation_id
          AND evaluation.application_id = NEW.application_id
          AND criterion.id = NEW.criterion_id
      )`,
      message: "human assessment must match the evaluation application and criteria",
    }));

    // ── Append-only enforcement ───────────────────────────────────────────────
    for (const [table, label] of [
      ["criterion_findings", "criterion findings are append-only"],
      ["criterion_evidence", "criterion evidence is append-only"],
      ["human_assessments", "human assessments are append-only"],
      ["human_assessment_evidence", "human assessment evidence is append-only"],
      ["employer_decisions", "employer decisions are append-only"],
    ] as const) {
      await client.exec(forbid({ name: `${table}_append_only_update`, table, operation: "UPDATE", message: label }));
      await client.exec(forbid({ name: `${table}_append_only_delete`, table, operation: "DELETE", message: label }));
    }

    // ── Decision citation integrity ───────────────────────────────────────────
    await client.exec(forbid({
      name: "decision_finding_same_application",
      table: "employer_decision_findings",
      operation: "INSERT",
      when: `(SELECT application_id FROM employer_decisions WHERE id = NEW.decision_id) <> (
        SELECT evaluation.application_id FROM criterion_findings finding
        JOIN application_evaluations evaluation ON evaluation.id = finding.evaluation_id
        WHERE finding.id = NEW.finding_id
      )`,
      message: "decision finding belongs to another application",
    }));
    await client.exec(forbid({
      name: "decision_finding_mandatory_only",
      table: "employer_decision_findings",
      operation: "INSERT",
      when: `(SELECT reason_category FROM employer_decisions WHERE id = NEW.decision_id) IN (
        'MANDATORY_CRITERION_NOT_MET', 'EVIDENCE_INSUFFICIENT_AFTER_REVIEW'
      ) AND (SELECT criterion_disposition_snapshot FROM criterion_findings WHERE id = NEW.finding_id) <> 'MANDATORY'`,
      message: "preferred findings cannot justify a deficiency decision",
    }));
    await client.exec(forbid({
      name: "decision_human_assessment_integrity",
      table: "employer_decision_human_assessments",
      operation: "INSERT",
      when: `(SELECT application_id FROM employer_decisions WHERE id = NEW.decision_id) <> (
        SELECT application_id FROM human_assessments WHERE id = NEW.assessment_id
      )`,
      message: "decision assessment belongs to another application",
    }));
    await client.exec(forbid({
      name: "decision_human_assessment_has_basis",
      table: "employer_decision_human_assessments",
      operation: "INSERT",
      when: `(SELECT assessment FROM human_assessments WHERE id = NEW.assessment_id) = 'NOT_SATISFIED'
        AND (SELECT review_source_id FROM human_assessments WHERE id = NEW.assessment_id) IS NULL
        AND NOT EXISTS (SELECT 1 FROM human_assessment_evidence WHERE assessment_id = NEW.assessment_id)`,
      message: "not satisfied human assessment requires evidence or a review source",
    }));

    // ── Non-applicant reason categories require independently recorded facts ──
    await client.exec(forbid({
      name: "decision_position_closed_has_fact",
      table: "employer_decisions",
      operation: "INSERT",
      when: `NEW.reason_category = 'POSITION_CLOSED' AND NOT EXISTS (
        SELECT 1 FROM applications application
        JOIN jobs job ON job.id = application.job_id
        WHERE application.id = NEW.application_id AND job.status = 'CLOSED'
      )`,
      message: "position closed requires a closed job",
    }));
    await client.exec(forbid({
      name: "decision_role_filled_has_fact",
      table: "employer_decisions",
      operation: "INSERT",
      when: `NEW.reason_category = 'ROLE_FILLED' AND NOT EXISTS (
        SELECT 1 FROM hiring_rounds WHERE id = NEW.hiring_round_id
          AND closed_at IS NOT NULL AND filled_by_application_id IS NOT NULL
      )`,
      message: "role filled requires a closed round with a selected application",
    }));
    await client.exec(forbid({
      name: "decision_business_need_changed_has_fact",
      table: "employer_decisions",
      operation: "INSERT",
      when: `NEW.reason_category = 'BUSINESS_NEED_CHANGED' AND NOT EXISTS (
        SELECT 1 FROM hiring_rounds WHERE id = NEW.hiring_round_id
          AND closed_at IS NOT NULL AND closure_reason IS NOT NULL
      )`,
      message: "business need changed requires a closed round reason",
    }));
    await client.exec(forbid({
      name: "decision_unresponsive_has_fact",
      table: "employer_decisions",
      operation: "INSERT",
      when: `NEW.reason_category = 'APPLICANT_UNRESPONSIVE' AND NOT EXISTS (
        SELECT 1 FROM contact_requests
        WHERE application_id = NEW.application_id
          AND responded_at IS NULL
          AND sent_at + make_interval(days => response_window_days) < now()
      )`,
      message: "applicant unresponsive requires an expired unanswered contact request",
    }));

    // ── Accommodation suppression (rule path and human-citation path) ─────────
    await client.exec(forbid({
      name: "accommodation_blocks_rule_non_advance",
      table: "application_transitions",
      operation: "INSERT",
      when: `NEW.to_state = 'NOT_ADVANCED' AND NEW.actor_kind = 'DETERMINISTIC_RULE'
       AND (
         (SELECT accommodation_notice_shown_at FROM applications WHERE id = NEW.application_id) IS NULL
         OR (SELECT accommodation_state FROM applications WHERE id = NEW.application_id) IN ('REQUESTED', 'IN_PROGRESS')
       )`,
      message: "accommodation pending or notice not shown",
    }));
    await client.exec(forbid({
      name: "accommodation_blocks_affected_decision_finding",
      table: "employer_decision_findings",
      operation: "INSERT",
      when: `EXISTS (
        SELECT 1
        FROM employer_decisions decision
        JOIN criterion_findings finding ON finding.id = NEW.finding_id
        JOIN application_evaluations evaluation ON evaluation.id = finding.evaluation_id
        JOIN accommodation_requests request ON request.application_id = decision.application_id
        JOIN accommodation_affected_criteria affected ON affected.request_id = request.id AND affected.criterion_id = finding.criterion_id
        WHERE decision.id = NEW.decision_id
          AND decision.decision = 'DO_NOT_ADVANCE'
          AND request.state IN ('REQUESTED', 'IN_PROGRESS')
          AND evaluation.application_id = decision.application_id
      )`,
      message: "accommodation pending for cited criterion",
    }));
  },
};
