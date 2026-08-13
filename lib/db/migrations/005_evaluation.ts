import type { SqliteConnection } from "@/lib/db/connection";

export const evaluationMigration = {
  version: 5,
  name: "evaluation",
  checksum: "sha256:cd2ec46588c9fce9f76b6d8a93fca3924f1ad6f13d4c1dfe3274cfb2c75cc6a1",
  up(connection: SqliteConnection) {
    connection.exec(`
      CREATE TABLE application_evaluations (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        run_number INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('IN_PROGRESS', 'COMPLETE', 'PARTIAL_DETERMINISTIC', 'FAILED', 'NOT_APPLICABLE')),
        evaluator_kind TEXT NOT NULL CHECK (evaluator_kind IN ('SYSTEM', 'MODEL')),
        model_name TEXT,
        model_version TEXT,
        prompt_version TEXT,
        schema_version TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
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
        requires_human_review INTEGER NOT NULL DEFAULT 0 CHECK (requires_human_review IN (0, 1)),
        evidence_source_kind TEXT NOT NULL CHECK (evidence_source_kind IN ('SELF_REPORTED', 'RESUME_STATED', 'VERIFIED')),
        created_at TEXT NOT NULL,
        CHECK (assessment_state <> 'NOT_SATISFIED' OR finding_origin = 'DETERMINISTIC_RULE'),
        CHECK (criterion_kind_snapshot <> 'HUMAN_JUDGMENT' OR assessment_state = 'REQUIRES_HUMAN_JUDGMENT'),
        CHECK (NOT (finding_origin = 'MODEL' AND criterion_kind_snapshot = 'HARD_ELIGIBILITY' AND assessment_state = 'SATISFIED'))
      );

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
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        kind TEXT NOT NULL CHECK (kind IN ('PHONE_SCREEN', 'INTERVIEW', 'WORK_SAMPLE', 'REFERENCE_CHECK', 'DOCUMENT_REVIEW')),
        occurred_at TEXT NOT NULL,
        participants TEXT NOT NULL,
        summary TEXT,
        recorded_by_user_id TEXT NOT NULL REFERENCES local_users(id)
      );
      CREATE TABLE human_assessments (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        evaluation_id TEXT NOT NULL REFERENCES application_evaluations(id),
        criterion_id TEXT NOT NULL REFERENCES job_criteria(id),
        assessment TEXT NOT NULL CHECK (assessment IN ('SATISFIED', 'NOT_SATISFIED', 'CANNOT_DETERMINE')),
        review_source_id TEXT REFERENCES review_sources(id),
        note TEXT,
        assessor_user_id TEXT NOT NULL REFERENCES local_users(id),
        created_at TEXT NOT NULL
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
        job_id TEXT NOT NULL REFERENCES local_jobs(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        label TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        filled_by_application_id TEXT REFERENCES local_applications(id),
        closure_reason TEXT,
        opened_by_user_id TEXT NOT NULL REFERENCES local_users(id)
      );
      CREATE TABLE contact_requests (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        channel TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        response_window_days INTEGER NOT NULL CHECK (response_window_days > 0),
        responded_at TEXT,
        recorded_by_user_id TEXT NOT NULL REFERENCES local_users(id)
      );
      CREATE TABLE employer_decisions (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        evaluation_id TEXT REFERENCES application_evaluations(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        hiring_round_id TEXT REFERENCES hiring_rounds(id),
        decision TEXT NOT NULL CHECK (decision IN ('ADVANCE', 'DO_NOT_ADVANCE', 'REQUEST_MORE_INFO')),
        reason_category TEXT CHECK (reason_category IN ('MANDATORY_CRITERION_NOT_MET', 'EVIDENCE_INSUFFICIENT_AFTER_REVIEW', 'HUMAN_JUDGMENT_CRITERION_NOT_MET', 'STRONGER_CANDIDATE_POOL', 'POSITION_CLOSED', 'ROLE_FILLED', 'BUSINESS_NEED_CHANGED', 'APPLICANT_UNRESPONSIVE')),
        internal_note TEXT,
        supersedes_decision_id TEXT REFERENCES employer_decisions(id),
        actor_user_id TEXT NOT NULL REFERENCES local_users(id),
        actor_company_user_id TEXT NOT NULL REFERENCES local_company_users(id),
        created_at TEXT NOT NULL,
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
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        evaluation_id TEXT NOT NULL REFERENCES application_evaluations(id),
        decision_id TEXT REFERENCES employer_decisions(id),
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        body_json TEXT NOT NULL,
        rendered_text TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        released_at TEXT,
        released_by_user_id TEXT REFERENCES local_users(id),
        superseded_at TEXT
      );
      CREATE TABLE evaluation_jobs (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        state TEXT NOT NULL CHECK (state IN ('PENDING', 'CLAIMED', 'SUCCEEDED', 'FAILED', 'DEAD_LETTERED')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        claimed_by TEXT,
        claimed_at TEXT,
        lease_expires_at TEXT,
        next_attempt_at TEXT NOT NULL,
        last_error_code TEXT,
        last_error_detail TEXT,
        dead_lettered_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TRIGGER criterion_findings_no_write_when_locked
      BEFORE INSERT ON criterion_findings
      WHEN (SELECT locked_by_decision_id FROM application_evaluations WHERE id = NEW.evaluation_id) IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'locked evaluation cannot receive findings'); END;
      CREATE TRIGGER employer_decisions_append_only_update
      BEFORE UPDATE ON employer_decisions
      BEGIN SELECT RAISE(ABORT, 'employer decisions are append-only'); END;
      CREATE TRIGGER employer_decisions_append_only_delete
      BEFORE DELETE ON employer_decisions
      BEGIN SELECT RAISE(ABORT, 'employer decisions are append-only'); END;
      CREATE TRIGGER audit_events_append_only_update
      BEFORE UPDATE ON audit_events
      BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
      CREATE TRIGGER audit_events_append_only_delete
      BEFORE DELETE ON audit_events
      BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
      CREATE TRIGGER decision_finding_same_application
      BEFORE INSERT ON employer_decision_findings
      WHEN (SELECT application_id FROM employer_decisions WHERE id = NEW.decision_id) <> (
        SELECT evaluation.application_id FROM criterion_findings finding
        JOIN application_evaluations evaluation ON evaluation.id = finding.evaluation_id
        WHERE finding.id = NEW.finding_id
      )
      BEGIN SELECT RAISE(ABORT, 'decision finding belongs to another application'); END;
      CREATE TRIGGER decision_finding_mandatory_only
      BEFORE INSERT ON employer_decision_findings
      WHEN (SELECT reason_category FROM employer_decisions WHERE id = NEW.decision_id) IN (
        'MANDATORY_CRITERION_NOT_MET', 'EVIDENCE_INSUFFICIENT_AFTER_REVIEW'
      ) AND (SELECT criterion_disposition_snapshot FROM criterion_findings WHERE id = NEW.finding_id) <> 'MANDATORY'
      BEGIN SELECT RAISE(ABORT, 'preferred findings cannot justify a deficiency decision'); END;
      CREATE TRIGGER decision_human_assessment_integrity
      BEFORE INSERT ON employer_decision_human_assessments
      WHEN (SELECT application_id FROM employer_decisions WHERE id = NEW.decision_id) <> (
        SELECT application_id FROM human_assessments WHERE id = NEW.assessment_id
      )
      BEGIN SELECT RAISE(ABORT, 'decision assessment belongs to another application'); END;
      CREATE TRIGGER decision_human_assessment_has_basis
      BEFORE INSERT ON employer_decision_human_assessments
      WHEN (SELECT assessment FROM human_assessments WHERE id = NEW.assessment_id) = 'NOT_SATISFIED'
        AND (SELECT review_source_id FROM human_assessments WHERE id = NEW.assessment_id) IS NULL
        AND NOT EXISTS (SELECT 1 FROM human_assessment_evidence WHERE assessment_id = NEW.assessment_id)
      BEGIN SELECT RAISE(ABORT, 'not satisfied human assessment requires evidence or a review source'); END;
      CREATE TRIGGER decision_position_closed_has_fact
      BEFORE INSERT ON employer_decisions
      WHEN NEW.reason_category = 'POSITION_CLOSED' AND NOT EXISTS (
        SELECT 1 FROM local_applications application
        JOIN local_jobs job ON job.id = application.job_id
        WHERE application.id = NEW.application_id AND job.status = 'CLOSED'
      )
      BEGIN SELECT RAISE(ABORT, 'position closed requires a closed job'); END;
      CREATE TRIGGER decision_role_filled_has_fact
      BEFORE INSERT ON employer_decisions
      WHEN NEW.reason_category = 'ROLE_FILLED' AND NOT EXISTS (
        SELECT 1 FROM hiring_rounds WHERE id = NEW.hiring_round_id
          AND closed_at IS NOT NULL AND filled_by_application_id IS NOT NULL
      )
      BEGIN SELECT RAISE(ABORT, 'role filled requires a closed round with a selected application'); END;
      CREATE TRIGGER decision_business_need_changed_has_fact
      BEFORE INSERT ON employer_decisions
      WHEN NEW.reason_category = 'BUSINESS_NEED_CHANGED' AND NOT EXISTS (
        SELECT 1 FROM hiring_rounds WHERE id = NEW.hiring_round_id
          AND closed_at IS NOT NULL AND closure_reason IS NOT NULL
      )
      BEGIN SELECT RAISE(ABORT, 'business need changed requires a closed round reason'); END;
      CREATE TRIGGER decision_unresponsive_has_fact
      BEFORE INSERT ON employer_decisions
      WHEN NEW.reason_category = 'APPLICANT_UNRESPONSIVE' AND NOT EXISTS (
        SELECT 1 FROM contact_requests
        WHERE application_id = NEW.application_id
          AND responded_at IS NULL
          AND datetime(sent_at, '+' || response_window_days || ' days') < datetime('now')
      )
      BEGIN SELECT RAISE(ABORT, 'applicant unresponsive requires an expired unanswered contact request'); END;
    `);
  },
};
