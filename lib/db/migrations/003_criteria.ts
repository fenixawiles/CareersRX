import type { SqliteConnection } from "@/lib/db/connection";

export const criteriaMigration = {
  version: 3,
  name: "criteria",
  checksum: "sha256:3182e7c121042698192f590d441bda3141ad2f41d7b5271d3a524447ce2fe2dd",
  up(connection: SqliteConnection) {
    connection.exec(`
      CREATE TABLE auto_enforceable_rule_templates (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        legal_basis TEXT NOT NULL
      );

      INSERT OR IGNORE INTO auto_enforceable_rule_templates (id, label, legal_basis) VALUES
        ('LICENSE_ATTESTATION', 'Professional license attestation', 'Applicant attestation of a legally required credential'),
        ('CERTIFICATION_ATTESTATION', 'Required certification attestation', 'Applicant attestation of a legally required credential'),
        ('WORK_AUTHORIZATION_ATTESTATION', 'Work authorization attestation', 'Applicant attestation of a legally required condition'),
        ('LEGAL_MINIMUM_AGE', 'Legal minimum age', 'Statutory minimum age for the role');

      CREATE TABLE job_criteria_sets (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES local_jobs(id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
        authoring_state TEXT NOT NULL CHECK (authoring_state IN ('STRUCTURED', 'UNSTRUCTURED')),
        published_at TEXT,
        published_by_user_id TEXT REFERENCES local_users(id),
        superseded_at TEXT,
        superseded_by_set_id TEXT REFERENCES job_criteria_sets(id),
        created_at TEXT NOT NULL,
        UNIQUE(job_id, version)
      );
      CREATE UNIQUE INDEX job_criteria_sets_one_draft_per_job
        ON job_criteria_sets(job_id) WHERE status = 'DRAFT';
      CREATE UNIQUE INDEX job_criteria_sets_one_published_per_job
        ON job_criteria_sets(job_id) WHERE status = 'PUBLISHED';

      CREATE TABLE job_criteria (
        id TEXT PRIMARY KEY,
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        ordinal INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('HARD_ELIGIBILITY', 'MINIMUM_QUALIFICATION', 'PREFERRED_QUALIFICATION', 'COMPENSATORY_MEMBER', 'HUMAN_JUDGMENT')),
        disposition TEXT NOT NULL CHECK (disposition IN ('MANDATORY', 'PREFERRED', 'INFORMATIONAL')),
        evaluation_mode TEXT NOT NULL CHECK (evaluation_mode IN ('DETERMINISTIC', 'EVIDENCE_MAPPING', 'HUMAN_ONLY')),
        label TEXT NOT NULL,
        statement TEXT NOT NULL,
        rule_template_id TEXT REFERENCES auto_enforceable_rule_templates(id),
        deterministic_rule_json TEXT,
        requires_human_review INTEGER NOT NULL DEFAULT 0 CHECK (requires_human_review IN (0, 1)),
        auto_enforceable INTEGER NOT NULL DEFAULT 0 CHECK (auto_enforceable IN (0, 1)),
        created_at TEXT NOT NULL,
        UNIQUE(criteria_set_id, ordinal),
        CHECK (kind <> 'PREFERRED_QUALIFICATION' OR disposition = 'PREFERRED'),
        CHECK (kind <> 'HUMAN_JUDGMENT' OR (evaluation_mode = 'HUMAN_ONLY' AND auto_enforceable = 0)),
        CHECK (auto_enforceable = 0 OR (
          kind = 'HARD_ELIGIBILITY' AND disposition = 'MANDATORY' AND
          evaluation_mode = 'DETERMINISTIC' AND rule_template_id IS NOT NULL
        ))
      );

      CREATE TABLE job_criteria_substitution_groups (
        id TEXT PRIMARY KEY,
        criteria_set_id TEXT NOT NULL REFERENCES job_criteria_sets(id),
        satisfies_criterion_id TEXT NOT NULL REFERENCES job_criteria(id),
        label TEXT NOT NULL
      );
      CREATE TABLE substitution_alternatives (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES job_criteria_substitution_groups(id),
        ordinal INTEGER NOT NULL,
        UNIQUE(group_id, ordinal)
      );
      CREATE TABLE substitution_alternative_members (
        alternative_id TEXT NOT NULL REFERENCES substitution_alternatives(id),
        criterion_id TEXT NOT NULL REFERENCES job_criteria(id),
        PRIMARY KEY(alternative_id, criterion_id)
      );

      CREATE TRIGGER job_criteria_no_edit_after_publish
      BEFORE UPDATE ON job_criteria
      WHEN (SELECT status FROM job_criteria_sets WHERE id = OLD.criteria_set_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT, 'published criteria are immutable'); END;
      CREATE TRIGGER job_criteria_no_delete_after_publish
      BEFORE DELETE ON job_criteria
      WHEN (SELECT status FROM job_criteria_sets WHERE id = OLD.criteria_set_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT, 'published criteria are immutable'); END;
      CREATE TRIGGER job_criteria_sets_no_edit_after_publish
      BEFORE UPDATE ON job_criteria_sets
      WHEN OLD.status = 'PUBLISHED' AND NOT (
        NEW.status IN ('PUBLISHED', 'SUPERSEDED') AND
        NEW.job_id = OLD.job_id AND NEW.version = OLD.version AND
        NEW.authoring_state = OLD.authoring_state AND NEW.created_at = OLD.created_at
      )
      BEGIN SELECT RAISE(ABORT, 'published criteria are immutable'); END;
    `);
  },
};
