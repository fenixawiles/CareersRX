import type { SqliteConnection } from "@/lib/db/connection";

export const retentionMigration = {
  version: 9,
  name: "retention",
  checksum: "sha256:a9b5aa6f6d9e879c439c23de3e6c3f5f6ff6508f45857f0d75a6c97aa3039889",
  up(connection: SqliteConnection) {
    connection.exec(`
      ALTER TABLE local_applications ADD COLUMN pseudonymized_at TEXT;
      ALTER TABLE applicant_explanations ADD COLUMN applicant_user_id TEXT REFERENCES local_users(id);
      ALTER TABLE applicant_explanations ADD COLUMN company_id TEXT REFERENCES local_companies(id);
      UPDATE applicant_explanations
      SET applicant_user_id = (SELECT seeker_user_id FROM local_applications WHERE id = applicant_explanations.application_id),
          company_id = (SELECT job.company_id FROM local_applications application JOIN local_jobs job ON job.id = application.job_id WHERE application.id = applicant_explanations.application_id);
      CREATE INDEX applicant_explanations_applicant_released_idx
        ON applicant_explanations(applicant_user_id, released_at DESC);
      CREATE INDEX applicant_explanations_company_released_idx
        ON applicant_explanations(company_id, released_at DESC);
      CREATE TRIGGER applicant_explanations_identity_immutable
      BEFORE UPDATE ON applicant_explanations
      WHEN NEW.applicant_user_id IS NOT OLD.applicant_user_id OR NEW.company_id IS NOT OLD.company_id
      BEGIN SELECT RAISE(ABORT, 'applicant explanation identity is immutable'); END;

      CREATE TABLE account_deletion_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES local_users(id),
        state TEXT NOT NULL CHECK (state IN ('REQUESTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
        requested_at TEXT NOT NULL,
        processed_at TEXT,
        processed_by TEXT,
        note TEXT
      );
      CREATE TABLE retention_sweeps (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES local_companies(id),
        state TEXT NOT NULL CHECK (state IN ('COMPLETED', 'FAILED')),
        retention_months INTEGER NOT NULL CHECK (retention_months >= 36),
        candidate_count INTEGER NOT NULL,
        pseudonymized_count INTEGER NOT NULL,
        legal_hold_count INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        error_detail TEXT
      );

      -- One narrow redaction path replaces direct snapshot mutation. It retains the record and its
      -- audit/decision history while removing application identity after retention eligibility.
      DROP TRIGGER local_applications_snapshot_immutable;
      CREATE TRIGGER local_applications_snapshot_immutable
      BEFORE UPDATE ON local_applications
      WHEN (
        NEW.profile_snapshot_json <> OLD.profile_snapshot_json
        OR NEW.resume_snapshot_json <> OLD.resume_snapshot_json
        OR NEW.snapshot_hash <> OLD.snapshot_hash
        OR NEW.criteria_set_id <> OLD.criteria_set_id
        OR NEW.job_id <> OLD.job_id
        OR NEW.seeker_user_id <> OLD.seeker_user_id
        OR NEW.submitted_at <> OLD.submitted_at
      ) AND NOT (
          OLD.pseudonymized_at IS NULL AND NEW.pseudonymized_at IS NOT NULL
          AND NEW.profile_snapshot_json = '{"redacted":true}'
          AND NEW.resume_snapshot_json = '{"redacted":true}'
        )
      BEGIN SELECT RAISE(ABORT, 'submitted application snapshot is immutable'); END;
      CREATE TRIGGER local_applications_no_repeat_pseudonymization
      BEFORE UPDATE ON local_applications
      WHEN OLD.pseudonymized_at IS NOT NULL AND NEW.pseudonymized_at <> OLD.pseudonymized_at
      BEGIN SELECT RAISE(ABORT, 'application is already pseudonymized'); END;
    `);
  },
};
