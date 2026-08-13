import { createHash, randomUUID } from "node:crypto";
import type { SqliteConnection } from "@/lib/db/connection";

type ApplicationRow = Record<string, unknown>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
    .join(",")}}`;
}

function snapshotHash(profileJson: string, resumeJson: string) {
  const profile = JSON.parse(profileJson) as unknown;
  const resume = JSON.parse(resumeJson) as unknown;
  return createHash("sha256").update(`${canonicalize(profile)}\n${canonicalize(resume)}`).digest("hex");
}

function dispositionFor(status: unknown) {
  switch (status) {
    case "WITHDRAWN":
      return "WITHDRAWN";
    case "REJECTED":
      return "NOT_ADVANCED";
    case "REVIEWED":
      return "UNDER_REVIEW";
    default:
      return "SUBMITTED";
  }
}

export const applicationLockMigration = {
  version: 4,
  name: "application_lock",
  checksum: "sha256:75e283ecf9b59ff0f88205a1b14b3ce08ec126983a41231f37fc66f3b5a220d9",
  up(connection: SqliteConnection) {
    const jobs = connection.prepare("SELECT id FROM local_jobs").all();
    const createdAt = new Date().toISOString();
    const insertSet = connection.prepare(`
      INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, published_at, created_at)
      VALUES (?, ?, 1, 'PUBLISHED', 'UNSTRUCTURED', ?, ?)
    `);
    for (const job of jobs) {
      const jobId = String(job.id);
      const current = connection
        .prepare("SELECT id FROM job_criteria_sets WHERE job_id = ? AND status = 'PUBLISHED'")
        .get(jobId);
      if (!current) insertSet.run(`legacy-unstructured-${jobId}`, jobId, createdAt, createdAt);
    }

    const applications = connection.prepare("SELECT * FROM local_applications ORDER BY created_at ASC").all() as ApplicationRow[];
    connection.exec(`
      CREATE TABLE local_applications_next (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES local_jobs(id),
        seeker_user_id TEXT NOT NULL REFERENCES local_users(id),
        seeker_name TEXT NOT NULL,
        seeker_email TEXT NOT NULL,
        seeker_headline TEXT NOT NULL,
        seeker_location TEXT NOT NULL,
        cover_letter TEXT NOT NULL,
        license_confirmed INTEGER NOT NULL CHECK (license_confirmed IN (0, 1)),
        profile_snapshot_json TEXT NOT NULL,
        resume_snapshot_json TEXT NOT NULL,
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        resume_revision_id TEXT,
        snapshot_hash TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        evaluation_state TEXT NOT NULL CHECK (evaluation_state IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'PARTIAL_DETERMINISTIC', 'FAILED', 'STALE', 'NOT_APPLICABLE')),
        disposition_state TEXT NOT NULL CHECK (disposition_state IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_HUMAN_REVIEW', 'ADVANCED', 'NOT_ADVANCED', 'WITHDRAWN', 'CLOSED')),
        accommodation_state TEXT NOT NULL DEFAULT 'NONE' CHECK (accommodation_state IN ('NONE', 'REQUESTED', 'IN_PROGRESS', 'PROVIDED', 'DECLINED')),
        accommodation_notice_shown_at TEXT,
        reopened_at TEXT,
        reopened_by_user_id TEXT REFERENCES local_users(id),
        current_decision_id TEXT,
        legal_hold INTEGER NOT NULL DEFAULT 0 CHECK (legal_hold IN (0, 1)),
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'REVIEWED', 'REJECTED', 'WITHDRAWN')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(job_id, seeker_user_id)
      );
    `);

    const insertApplication = connection.prepare(`
      INSERT INTO local_applications_next (
        id, job_id, seeker_user_id, seeker_name, seeker_email, seeker_headline, seeker_location,
        cover_letter, license_confirmed, profile_snapshot_json, resume_snapshot_json, criteria_set_id,
        resume_revision_id, snapshot_hash, submitted_at, evaluation_state, disposition_state,
        accommodation_state, accommodation_notice_shown_at, reopened_at, reopened_by_user_id,
        current_decision_id, legal_hold, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const application of applications) {
      const jobId = String(application.job_id);
      const criteriaSet = connection
        .prepare("SELECT id FROM job_criteria_sets WHERE job_id = ? AND status = 'PUBLISHED'")
        .get(jobId);
      if (!criteriaSet?.id) throw new Error(`Cannot backfill application ${String(application.id)} without a published criteria set.`);
      const profileJson = String(application.profile_snapshot_json);
      const resumeJson = String(application.resume_snapshot_json);
      insertApplication.run(
        String(application.id),
        jobId,
        String(application.seeker_user_id),
        String(application.seeker_name),
        String(application.seeker_email),
        String(application.seeker_headline),
        String(application.seeker_location),
        String(application.cover_letter),
        Number(application.license_confirmed) === 1 ? 1 : 0,
        profileJson,
        resumeJson,
        String(criteriaSet.id),
        null,
        snapshotHash(profileJson, resumeJson),
        String(application.created_at),
        "NOT_APPLICABLE",
        dispositionFor(application.status),
        "NONE",
        null,
        null,
        null,
        null,
        0,
        String(application.status),
        String(application.created_at),
        String(application.updated_at),
      );
    }

    connection.exec(`
      DROP TABLE local_applications;
      ALTER TABLE local_applications_next RENAME TO local_applications;
      CREATE INDEX local_applications_seeker_submitted_idx ON local_applications(seeker_user_id, submitted_at DESC);
      CREATE INDEX local_applications_job_submitted_idx ON local_applications(job_id, submitted_at DESC);

      CREATE TABLE application_transitions (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        from_state TEXT,
        to_state TEXT NOT NULL,
        actor_kind TEXT NOT NULL CHECK (actor_kind IN ('HUMAN', 'DETERMINISTIC_RULE', 'SYSTEM')),
        actor_user_id TEXT REFERENCES local_users(id),
        rule_criterion_id TEXT REFERENCES job_criteria(id),
        rationale TEXT,
        created_at TEXT NOT NULL,
        CHECK (actor_kind <> 'HUMAN' OR actor_user_id IS NOT NULL)
      );
      CREATE TRIGGER application_transitions_append_only_update
      BEFORE UPDATE ON application_transitions
      BEGIN SELECT RAISE(ABORT, 'application transitions are append-only'); END;
      CREATE TRIGGER application_transitions_append_only_delete
      BEFORE DELETE ON application_transitions
      BEGIN SELECT RAISE(ABORT, 'application transitions are append-only'); END;

      CREATE TABLE accommodation_requests (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES local_applications(id),
        requested_at TEXT NOT NULL,
        request_text TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('REQUESTED', 'IN_PROGRESS', 'PROVIDED', 'DECLINED')),
        handled_by_user_id TEXT REFERENCES local_users(id),
        handled_at TEXT,
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
        user_id TEXT NOT NULL REFERENCES local_users(id),
        request_body_hash TEXT NOT NULL,
        status_code INTEGER,
        response_json TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY(key, user_id)
      );
      CREATE TABLE retention_policies (
        company_id TEXT PRIMARY KEY REFERENCES local_companies(id),
        retention_months INTEGER NOT NULL DEFAULT 36 CHECK (retention_months >= 36),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TRIGGER local_applications_snapshot_immutable
      BEFORE UPDATE ON local_applications
      WHEN NEW.profile_snapshot_json <> OLD.profile_snapshot_json
        OR NEW.resume_snapshot_json <> OLD.resume_snapshot_json
        OR NEW.snapshot_hash <> OLD.snapshot_hash
        OR NEW.criteria_set_id <> OLD.criteria_set_id
        OR NEW.job_id <> OLD.job_id
        OR NEW.seeker_user_id <> OLD.seeker_user_id
        OR NEW.submitted_at <> OLD.submitted_at
      BEGIN SELECT RAISE(ABORT, 'submitted application snapshot is immutable'); END;
    `);

    const insertAudit = connection.prepare(`
      INSERT INTO audit_events (id, event_type, actor_kind, actor_user_id, entity_type, entity_id, company_id, metadata_json, created_at)
      VALUES (?, 'BACKFILL_COMPLETED', 'SYSTEM', NULL, 'DATABASE', 'local_applications', NULL, ?, ?)
    `);
    insertAudit.run(randomUUID(), JSON.stringify({ applications: applications.length, jobs: jobs.length }), createdAt);
  },
};
