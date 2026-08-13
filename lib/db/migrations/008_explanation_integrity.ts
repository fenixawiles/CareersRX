import type { SqliteConnection } from "@/lib/db/connection";

export const explanationIntegrityMigration = {
  version: 8,
  name: "explanation_integrity",
  checksum: "sha256:baab5e5556dcf05a7869f2207c9e9ba488719c488e7c020d9a02f60c7076ee2f",
  up(connection: SqliteConnection) {
    connection.exec(`
      CREATE UNIQUE INDEX applicant_explanations_one_per_decision
        ON applicant_explanations(decision_id) WHERE decision_id IS NOT NULL;
      CREATE TRIGGER applicant_explanations_immutable
      BEFORE UPDATE ON applicant_explanations
      WHEN NEW.id <> OLD.id
        OR NEW.application_id <> OLD.application_id
        OR NEW.evaluation_id <> OLD.evaluation_id
        OR NEW.decision_id IS NOT OLD.decision_id
        OR NEW.criteria_set_id <> OLD.criteria_set_id
        OR NEW.body_json <> OLD.body_json
        OR NEW.rendered_text <> OLD.rendered_text
        OR NEW.generated_at <> OLD.generated_at
        OR NEW.superseded_at IS NOT OLD.superseded_at
        OR (OLD.released_at IS NOT NULL AND (
          NEW.released_at <> OLD.released_at OR NEW.released_by_user_id IS NOT OLD.released_by_user_id
        ))
        OR (OLD.released_at IS NULL AND NEW.released_at IS NULL)
      BEGIN SELECT RAISE(ABORT, 'applicant explanations are immutable after release'); END;
      CREATE TRIGGER applicant_explanations_no_delete
      BEFORE DELETE ON applicant_explanations
      BEGIN SELECT RAISE(ABORT, 'applicant explanations are retained'); END;
    `);
  },
};
