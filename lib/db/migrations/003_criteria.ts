import type { Migration } from "@/lib/db/migrate";
import { forbid } from "@/lib/db/migrations/util";

export const criteriaMigration: Migration = {
  version: 3,
  name: "criteria",
  checksum: "sha256:pg-criteria-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE auto_enforceable_rule_templates (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        legal_basis TEXT NOT NULL
      );

      INSERT INTO auto_enforceable_rule_templates (id, label, legal_basis) VALUES
        ('LICENSE_ATTESTATION', 'Professional license attestation', 'Applicant attestation of a legally required credential'),
        ('CERTIFICATION_ATTESTATION', 'Required certification attestation', 'Applicant attestation of a legally required credential'),
        ('WORK_AUTHORIZATION_ATTESTATION', 'Work authorization attestation', 'Applicant attestation of a legally required condition'),
        ('LEGAL_MINIMUM_AGE', 'Legal minimum age', 'Statutory minimum age for the role')
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE job_criteria_sets (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id),
        version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
        authoring_state TEXT NOT NULL CHECK (authoring_state IN ('STRUCTURED', 'UNSTRUCTURED')),
        published_at TIMESTAMPTZ,
        published_by_user_id TEXT REFERENCES users(id),
        superseded_at TIMESTAMPTZ,
        superseded_by_set_id TEXT REFERENCES job_criteria_sets(id),
        created_at TIMESTAMPTZ NOT NULL,
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
        deterministic_rule_json JSONB,
        requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
        auto_enforceable BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE(criteria_set_id, ordinal),
        CHECK (kind <> 'PREFERRED_QUALIFICATION' OR disposition = 'PREFERRED'),
        CHECK (kind <> 'HUMAN_JUDGMENT' OR (evaluation_mode = 'HUMAN_ONLY' AND NOT auto_enforceable)),
        CHECK (NOT auto_enforceable OR (
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
    `);

    // The SQLite original guarded UPDATE/DELETE only; INSERT into a published set is equally a
    // mutation of published criteria and is now blocked at the same layer.
    await client.exec(forbid({
      name: "job_criteria_no_insert_after_publish",
      table: "job_criteria",
      operation: "INSERT",
      when: "(SELECT status FROM job_criteria_sets WHERE id = NEW.criteria_set_id) <> 'DRAFT'",
      message: "published criteria are immutable",
    }));
    await client.exec(forbid({
      name: "job_criteria_no_edit_after_publish",
      table: "job_criteria",
      operation: "UPDATE",
      when: "(SELECT status FROM job_criteria_sets WHERE id = OLD.criteria_set_id) <> 'DRAFT'",
      message: "published criteria are immutable",
    }));
    await client.exec(forbid({
      name: "job_criteria_no_delete_after_publish",
      table: "job_criteria",
      operation: "DELETE",
      when: "(SELECT status FROM job_criteria_sets WHERE id = OLD.criteria_set_id) <> 'DRAFT'",
      message: "published criteria are immutable",
    }));
    await client.exec(forbid({
      name: "job_criteria_sets_no_edit_after_publish",
      table: "job_criteria_sets",
      operation: "UPDATE",
      when: `OLD.status = 'PUBLISHED' AND NOT (
        NEW.status IN ('PUBLISHED', 'SUPERSEDED') AND
        NEW.job_id = OLD.job_id AND NEW.version = OLD.version AND
        NEW.authoring_state = OLD.authoring_state AND NEW.created_at = OLD.created_at
      )`,
      message: "published criteria are immutable",
    }));
  },
};
