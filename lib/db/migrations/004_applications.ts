import type { Migration } from "@/lib/db/migrate";
import { forbid } from "@/lib/db/migrations/util";

export const applicationsMigration: Migration = {
  version: 4,
  name: "applications",
  checksum: "sha256:pg-applications-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id),
        seeker_user_id TEXT NOT NULL REFERENCES users(id),
        seeker_name TEXT NOT NULL,
        seeker_email TEXT NOT NULL,
        seeker_headline TEXT NOT NULL,
        seeker_location TEXT NOT NULL,
        cover_letter TEXT NOT NULL,
        license_confirmed BOOLEAN NOT NULL,
        profile_snapshot_json JSONB NOT NULL,
        resume_snapshot_json JSONB NOT NULL,
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        resume_revision_id TEXT,
        snapshot_hash TEXT NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL,
        evaluation_state TEXT NOT NULL CHECK (evaluation_state IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'PARTIAL_DETERMINISTIC', 'FAILED', 'STALE', 'NOT_APPLICABLE')),
        disposition_state TEXT NOT NULL CHECK (disposition_state IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_HUMAN_REVIEW', 'ADVANCED', 'NOT_ADVANCED', 'WITHDRAWN', 'CLOSED')),
        accommodation_state TEXT NOT NULL DEFAULT 'NONE' CHECK (accommodation_state IN ('NONE', 'REQUESTED', 'IN_PROGRESS', 'PROVIDED', 'DECLINED')),
        accommodation_notice_shown_at TIMESTAMPTZ,
        reopened_at TIMESTAMPTZ,
        reopened_by_user_id TEXT REFERENCES users(id),
        current_decision_id TEXT,
        legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
        pseudonymized_at TIMESTAMPTZ,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'REVIEWED', 'REJECTED', 'WITHDRAWN')),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE(job_id, seeker_user_id)
      );
      CREATE INDEX applications_seeker_submitted_idx ON applications(seeker_user_id, submitted_at DESC);
      CREATE INDEX applications_job_submitted_idx ON applications(job_id, submitted_at DESC);

      CREATE TABLE application_transitions (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        from_state TEXT,
        to_state TEXT NOT NULL,
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('HUMAN', 'DETERMINISTIC_RULE', 'SYSTEM')),
        actor_user_id TEXT REFERENCES users(id),
        rule_criterion_id TEXT REFERENCES job_criteria(id),
        rationale TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        CHECK (actor_kind <> 'HUMAN' OR actor_user_id IS NOT NULL)
      );

      CREATE TABLE accommodation_requests (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id),
        requested_at TIMESTAMPTZ NOT NULL,
        request_text TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('REQUESTED', 'IN_PROGRESS', 'PROVIDED', 'DECLINED')),
        handled_by_user_id TEXT REFERENCES users(id),
        handled_at TIMESTAMPTZ,
        resolution_note TEXT
      );
      CREATE TABLE accommodation_affected_criteria (
        request_id TEXT NOT NULL REFERENCES accommodation_requests(id),
        criterion_id TEXT NOT NULL REFERENCES job_criteria(id),
        PRIMARY KEY(request_id, criterion_id)
      );

      CREATE TABLE idempotency_keys (
        key TEXT NOT NULL,
        method TEXT NOT NULL,
        route TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        request_body_hash TEXT NOT NULL,
        status_code INTEGER,
        response_json JSONB,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(key, user_id)
      );

      CREATE TABLE retention_policies (
        company_id TEXT PRIMARY KEY REFERENCES companies(id),
        retention_months INTEGER NOT NULL DEFAULT 36 CHECK (retention_months >= 36),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.exec(forbid({
      name: "application_transitions_append_only_update",
      table: "application_transitions",
      operation: "UPDATE",
      message: "application transitions are append-only",
    }));
    await client.exec(forbid({
      name: "application_transitions_append_only_delete",
      table: "application_transitions",
      operation: "DELETE",
      message: "application transitions are append-only",
    }));

    // The snapshot seal, with one narrow carve-out: retention pseudonymization may redact both
    // snapshots exactly once, marking pseudonymized_at in the same statement.
    await client.exec(forbid({
      name: "applications_snapshot_immutable",
      table: "applications",
      operation: "UPDATE",
      when: `(
        NEW.profile_snapshot_json IS DISTINCT FROM OLD.profile_snapshot_json
        OR NEW.resume_snapshot_json IS DISTINCT FROM OLD.resume_snapshot_json
        OR NEW.snapshot_hash <> OLD.snapshot_hash
        OR NEW.criteria_set_id <> OLD.criteria_set_id
        OR NEW.job_id <> OLD.job_id
        OR NEW.seeker_user_id <> OLD.seeker_user_id
        OR NEW.submitted_at <> OLD.submitted_at
      ) AND NOT (
        OLD.pseudonymized_at IS NULL AND NEW.pseudonymized_at IS NOT NULL
        AND NEW.profile_snapshot_json = '{"redacted":true}'::jsonb
        AND NEW.resume_snapshot_json = '{"redacted":true}'::jsonb
      )`,
      message: "submitted application snapshot is immutable",
    }));
    await client.exec(forbid({
      name: "applications_no_repeat_pseudonymization",
      table: "applications",
      operation: "UPDATE",
      when: "OLD.pseudonymized_at IS NOT NULL AND NEW.pseudonymized_at IS DISTINCT FROM OLD.pseudonymized_at",
      message: "application is already pseudonymized",
    }));
  },
};
