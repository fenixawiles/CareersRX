import type { SqliteConnection } from "@/lib/db/connection";

export const accommodationEnforcementMigration = {
  version: 10,
  name: "accommodation_enforcement",
  checksum: "sha256:accommodation-enforcement-v1",
  up(connection: SqliteConnection) {
    connection.exec(`
      CREATE TRIGGER accommodation_blocks_rule_non_advance
      BEFORE INSERT ON application_transitions
      WHEN NEW.to_state = 'NOT_ADVANCED' AND NEW.actor_kind = 'DETERMINISTIC_RULE'
       AND (
         (SELECT accommodation_notice_shown_at FROM local_applications WHERE id = NEW.application_id) IS NULL
         OR (SELECT accommodation_state FROM local_applications WHERE id = NEW.application_id) IN ('REQUESTED', 'IN_PROGRESS')
       )
      BEGIN SELECT RAISE(ABORT, 'accommodation pending or notice not shown'); END;

      CREATE TRIGGER accommodation_blocks_affected_decision_finding
      BEFORE INSERT ON employer_decision_findings
      WHEN EXISTS (
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
      )
      BEGIN SELECT RAISE(ABORT, 'accommodation pending for cited criterion'); END;
    `);
  },
};
