import type { SqliteConnection } from "@/lib/db/connection";

export const baselineMigration = {
  version: 1,
  name: "baseline",
  // Changing an adopted baseline must be a new migration rather than silently changing its history.
  checksum: "sha256:aa90b8d73c85a0e9e04604a28f6d00e2a18443d524aa40c00661ad8f9de9d7d6",
  up(connection: SqliteConnection) {
    // Exact legacy tables are adopted with IF NOT EXISTS. On an existing Railway volume, this does
    // not rewrite either rows or DDL; on a fresh database it creates a complete legacy baseline so
    // every later migration can run independently of route visitation order.
    connection.exec(`
      CREATE TABLE IF NOT EXISTS local_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        website TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        verification_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_company_users (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        user_id TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_jobs (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        facility_type TEXT,
        job_type TEXT NOT NULL,
        shifts_json TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        benefits TEXT NOT NULL,
        salary_min_cents INTEGER,
        salary_max_cents INTEGER,
        pay_type TEXT,
        show_salary INTEGER NOT NULL,
        eeo_statement TEXT NOT NULL,
        status TEXT NOT NULL,
        published_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_applications (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        seeker_user_id TEXT NOT NULL,
        seeker_name TEXT NOT NULL,
        seeker_email TEXT NOT NULL,
        seeker_headline TEXT NOT NULL,
        seeker_location TEXT NOT NULL,
        cover_letter TEXT NOT NULL,
        license_confirmed INTEGER NOT NULL,
        profile_snapshot_json TEXT NOT NULL,
        resume_snapshot_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(job_id, seeker_user_id)
      );

      CREATE TABLE IF NOT EXISTS local_saved_jobs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        seeker_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(job_id, seeker_user_id)
      );

      CREATE TABLE IF NOT EXISTS sandbox_state (
        id TEXT PRIMARY KEY,
        profile_json TEXT NOT NULL,
        resume_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sandbox_versions (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        resume_json TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sandbox_named_resume_versions (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        title TEXT NOT NULL,
        purpose TEXT,
        status TEXT NOT NULL,
        source_version_id TEXT,
        active_revision_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sandbox_resume_revisions (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        named_version_id TEXT NOT NULL,
        revision_number INTEGER NOT NULL,
        resume_json TEXT NOT NULL,
        source TEXT NOT NULL,
        note TEXT,
        sync_summary_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sandbox_active_resume_version (
        sandbox_id TEXT PRIMARY KEY,
        named_version_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sandbox_proposals (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        target TEXT NOT NULL,
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        proposed_value_json TEXT NOT NULL,
        before_value_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        decided_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sandbox_audit (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        before_value_json TEXT NOT NULL,
        after_value_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sandbox_ai_interactions (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        task TEXT NOT NULL,
        model TEXT NOT NULL,
        fallback_model TEXT,
        status TEXT NOT NULL,
        input_metadata_json TEXT,
        parsed_output_json TEXT,
        raw_response_id TEXT,
        error TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sandbox_resume_imports (
        id TEXT PRIMARY KEY,
        sandbox_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        extracted_text TEXT NOT NULL,
        extractor TEXT NOT NULL,
        intent TEXT NOT NULL,
        status TEXT NOT NULL,
        parsed_result_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        applied_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_kind TEXT NOT NULL,
        actor_user_id TEXT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        company_id TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  },
};
