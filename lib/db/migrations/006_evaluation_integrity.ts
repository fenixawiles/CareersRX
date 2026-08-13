import type { SqliteConnection } from "@/lib/db/connection";

/**
 * Database-level backstops for the service layer. These make cross-application or post-finalization
 * writes fail even if a future caller bypasses the TypeScript persistence functions.
 */
export const evaluationIntegrityMigration = {
  version: 6,
  name: "evaluation_integrity",
  checksum: "sha256:6e19ca3d15703ed29b017de449c7b1f91ccf50ec19c3a1013cc0b3bd11838927",
  up(connection: SqliteConnection) {
    connection.exec(`
      CREATE UNIQUE INDEX criterion_findings_evaluation_criterion_unique
        ON criterion_findings(evaluation_id, criterion_id);

      CREATE TRIGGER evaluation_matches_structured_application
      BEFORE INSERT ON application_evaluations
      WHEN NOT EXISTS (
        SELECT 1
        FROM local_applications application
        JOIN job_criteria_sets criteria_set ON criteria_set.id = application.criteria_set_id
        WHERE application.id = NEW.application_id
          AND application.criteria_set_id = NEW.criteria_set_id
          AND criteria_set.status = 'PUBLISHED'
          AND criteria_set.authoring_state = 'STRUCTURED'
      )
      BEGIN SELECT RAISE(ABORT, 'evaluation must use the application locked structured criteria set'); END;

      CREATE TRIGGER criterion_finding_matches_evaluation_criteria
      BEFORE INSERT ON criterion_findings
      WHEN NOT EXISTS (
        SELECT 1
        FROM application_evaluations evaluation
        JOIN job_criteria criterion ON criterion.criteria_set_id = evaluation.criteria_set_id
        WHERE evaluation.id = NEW.evaluation_id AND criterion.id = NEW.criterion_id
      )
      BEGIN SELECT RAISE(ABORT, 'criterion does not belong to evaluation criteria set'); END;
      CREATE TRIGGER criterion_finding_only_during_active_run
      BEFORE INSERT ON criterion_findings
      WHEN (SELECT state FROM application_evaluations WHERE id = NEW.evaluation_id) <> 'IN_PROGRESS'
      BEGIN SELECT RAISE(ABORT, 'findings can only be added to an in-progress evaluation'); END;

      CREATE TRIGGER human_assessment_matches_evaluation
      BEFORE INSERT ON human_assessments
      WHEN NOT EXISTS (
        SELECT 1
        FROM application_evaluations evaluation
        JOIN job_criteria criterion ON criterion.criteria_set_id = evaluation.criteria_set_id
        WHERE evaluation.id = NEW.evaluation_id
          AND evaluation.application_id = NEW.application_id
          AND criterion.id = NEW.criterion_id
      )
      BEGIN SELECT RAISE(ABORT, 'human assessment must match the evaluation application and criteria'); END;

      CREATE TRIGGER criterion_findings_append_only_update
      BEFORE UPDATE ON criterion_findings
      BEGIN SELECT RAISE(ABORT, 'criterion findings are append-only'); END;
      CREATE TRIGGER criterion_findings_append_only_delete
      BEFORE DELETE ON criterion_findings
      BEGIN SELECT RAISE(ABORT, 'criterion findings are append-only'); END;
      CREATE TRIGGER criterion_evidence_append_only_update
      BEFORE UPDATE ON criterion_evidence
      BEGIN SELECT RAISE(ABORT, 'criterion evidence is append-only'); END;
      CREATE TRIGGER criterion_evidence_append_only_delete
      BEFORE DELETE ON criterion_evidence
      BEGIN SELECT RAISE(ABORT, 'criterion evidence is append-only'); END;
      CREATE TRIGGER human_assessments_append_only_update
      BEFORE UPDATE ON human_assessments
      BEGIN SELECT RAISE(ABORT, 'human assessments are append-only'); END;
      CREATE TRIGGER human_assessments_append_only_delete
      BEFORE DELETE ON human_assessments
      BEGIN SELECT RAISE(ABORT, 'human assessments are append-only'); END;
      CREATE TRIGGER human_assessment_evidence_append_only_update
      BEFORE UPDATE ON human_assessment_evidence
      BEGIN SELECT RAISE(ABORT, 'human assessment evidence is append-only'); END;
      CREATE TRIGGER human_assessment_evidence_append_only_delete
      BEFORE DELETE ON human_assessment_evidence
      BEGIN SELECT RAISE(ABORT, 'human assessment evidence is append-only'); END;
    `);
  },
};
