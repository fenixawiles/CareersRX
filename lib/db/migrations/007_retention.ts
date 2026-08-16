import type { Migration } from "@/lib/db/migrate";
import { forbid } from "@/lib/db/migrations/util";

export const retentionMigration: Migration = {
  version: 7,
  name: "retention",
  checksum: "sha256:pg-retention-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE account_deletion_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        state TEXT NOT NULL CHECK (state IN ('REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
        requested_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        processed_by TEXT,
        note TEXT
      );

      CREATE TABLE retention_sweeps (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id),
        state TEXT NOT NULL CHECK (state IN ('COMPLETED', 'FAILED')),
        retention_months INTEGER NOT NULL CHECK (retention_months >= 36),
        candidate_count INTEGER NOT NULL,
        pseudonymized_count INTEGER NOT NULL,
        legal_hold_count INTEGER NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL,
        error_detail TEXT
      );
    `);

    // Explanation immutability, including the identity columns used by insights/analytics scoping.
    await client.exec(forbid({
      name: "applicant_explanations_immutable",
      table: "applicant_explanations",
      operation: "UPDATE",
      when: `NEW.id <> OLD.id
        OR NEW.application_id <> OLD.application_id
        OR NEW.evaluation_id <> OLD.evaluation_id
        OR NEW.decision_id IS DISTINCT FROM OLD.decision_id
        OR NEW.criteria_set_id <> OLD.criteria_set_id
        OR NEW.applicant_user_id IS DISTINCT FROM OLD.applicant_user_id
        OR NEW.company_id IS DISTINCT FROM OLD.company_id
        OR NEW.body_json IS DISTINCT FROM OLD.body_json
        OR NEW.rendered_text <> OLD.rendered_text
        OR NEW.generated_at <> OLD.generated_at
        OR NEW.superseded_at IS DISTINCT FROM OLD.superseded_at
        OR (OLD.released_at IS NOT NULL AND (
          NEW.released_at IS DISTINCT FROM OLD.released_at OR NEW.released_by_user_id IS DISTINCT FROM OLD.released_by_user_id
        ))
        OR (OLD.released_at IS NULL AND NEW.released_at IS NULL)`,
      message: "applicant explanations are immutable after release",
    }));
    await client.exec(forbid({
      name: "applicant_explanations_no_delete",
      table: "applicant_explanations",
      operation: "DELETE",
      message: "applicant explanations are retained",
    }));
  },
};
