import type { Migration } from "@/lib/db/migrate";

/**
 * The live-résumé domain, relational. Profile facts and the editable résumé sections are rows;
 * revision history keeps whole-résumé JSONB snapshots because a revision is by nature a document
 * (it is restored and compared as a unit). Everything cascades from the owning user.
 */
export const resumeMigration: Migration = {
  version: 2,
  name: "resume",
  checksum: "sha256:pg-resume-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE seeker_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL DEFAULT '',
        full_name TEXT NOT NULL DEFAULT '',
        headline TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        experience TEXT NOT NULL DEFAULT '',
        skills JSONB NOT NULL DEFAULT '[]',
        credentials JSONB NOT NULL DEFAULT '[]',
        preferred_roles JSONB NOT NULL DEFAULT '[]',
        preferred_locations JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE resumes (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled Live Résumé',
        target_role TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE resume_sections (
        user_id TEXT NOT NULL REFERENCES resumes(user_id) ON DELETE CASCADE,
        section_id TEXT NOT NULL CHECK (section_id IN ('summary', 'experience', 'credentials', 'skills', 'preferences')),
        title TEXT NOT NULL,
        helper TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        sync_status TEXT NOT NULL CHECK (sync_status IN ('BLANK', 'DRAFT', 'SYNCED', 'NEEDS_REVIEW', 'RESUME_ONLY')),
        ordinal INTEGER NOT NULL,
        PRIMARY KEY (user_id, section_id)
      );

      CREATE TABLE resume_named_versions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
        source_version_id TEXT,
        active_revision_id TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX resume_named_versions_user_updated_idx ON resume_named_versions(user_id, updated_at DESC);

      CREATE TABLE resume_revisions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        named_version_id TEXT NOT NULL REFERENCES resume_named_versions(id) ON DELETE CASCADE,
        revision_number INTEGER NOT NULL,
        resume_json JSONB NOT NULL,
        source TEXT NOT NULL,
        note TEXT,
        sync_summary_json JSONB,
        created_at TIMESTAMPTZ NOT NULL,
        UNIQUE(named_version_id, revision_number)
      );
      CREATE INDEX resume_revisions_user_idx ON resume_revisions(user_id, created_at DESC);

      CREATE TABLE resume_active_versions (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        named_version_id TEXT NOT NULL REFERENCES resume_named_versions(id) ON DELETE CASCADE
      );

      CREATE TABLE resume_proposals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        target TEXT NOT NULL,
        scope TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPLIED', 'REJECTED')),
        proposed_value_json JSONB NOT NULL,
        before_value_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        decided_at TIMESTAMPTZ
      );
      CREATE INDEX resume_proposals_user_created_idx ON resume_proposals(user_id, created_at DESC);

      CREATE TABLE career_audit (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        before_value_json JSONB NOT NULL,
        after_value_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX career_audit_user_created_idx ON career_audit(user_id, created_at DESC);

      CREATE TABLE ai_interactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task TEXT NOT NULL,
        model TEXT NOT NULL,
        fallback_model TEXT,
        status TEXT NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
        input_metadata_json JSONB,
        parsed_output_json JSONB,
        raw_response_id TEXT,
        error TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        created_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ
      );
      CREATE INDEX ai_interactions_user_created_idx ON ai_interactions(user_id, created_at DESC);

      CREATE TABLE resume_imports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        extracted_text TEXT NOT NULL,
        extractor TEXT NOT NULL,
        intent TEXT NOT NULL CHECK (intent IN ('new_version', 'replace_current', 'signup_onboarding')),
        status TEXT NOT NULL CHECK (status IN ('PARSED', 'APPLIED', 'FAILED')),
        parsed_result_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        applied_at TIMESTAMPTZ
      );
      CREATE INDEX resume_imports_user_created_idx ON resume_imports(user_id, created_at DESC);
    `);
  },
};
