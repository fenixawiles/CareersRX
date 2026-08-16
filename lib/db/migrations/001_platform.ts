import type { Migration } from "@/lib/db/migrate";
import { forbid } from "@/lib/db/migrations/util";

export const platformMigration: Migration = {
  version: 1,
  name: "platform",
  checksum: "sha256:pg-platform-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('SEEKER', 'EMPLOYER')),
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        email_verified_at TIMESTAMPTZ,
        failed_logins INTEGER NOT NULL DEFAULT 0 CHECK (failed_logins >= 0),
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX sessions_user_id_idx ON sessions(user_id);

      CREATE TABLE tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX tokens_email_type_idx ON tokens(email, type);
      CREATE INDEX tokens_user_id_idx ON tokens(user_id);

      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        website TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        verification_status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE company_users (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'RECRUITER')),
        revoked_at TIMESTAMPTZ,
        revoked_by_user_id TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE(company_id, user_id)
      );
      CREATE INDEX company_users_user_id_idx ON company_users(user_id);
      CREATE INDEX company_users_company_id_idx ON company_users(company_id);

      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id),
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        facility_type TEXT,
        job_type TEXT NOT NULL,
        shifts_json JSONB NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        benefits TEXT NOT NULL,
        salary_min_cents INTEGER,
        salary_max_cents INTEGER,
        pay_type TEXT,
        show_salary BOOLEAN NOT NULL,
        eeo_statement TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'CLOSED')),
        published_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX jobs_company_status_idx ON jobs(company_id, status);
      CREATE INDEX jobs_status_published_idx ON jobs(status, published_at DESC);

      CREATE TABLE saved_jobs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        seeker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE(job_id, seeker_user_id)
      );

      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_kind TEXT NOT NULL,
        actor_user_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        company_id TEXT,
        metadata_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id);
      CREATE INDEX audit_events_created_idx ON audit_events(created_at DESC);
    `);

    await client.exec(forbid({
      name: "audit_events_append_only_update",
      table: "audit_events",
      operation: "UPDATE",
      message: "audit events are append-only",
    }));
    await client.exec(forbid({
      name: "audit_events_append_only_delete",
      table: "audit_events",
      operation: "DELETE",
      message: "audit events are append-only",
    }));
  },
};
