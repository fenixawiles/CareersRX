import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { queryFile, runFile, transactionFile } from "../lib/db/sql";

function temporaryDatabasePath() {
  return join(mkdtempSync(join(tmpdir(), "careersrx-sql-test-")), "test.sqlite");
}

describe("SQLite transaction primitives", () => {
  it("creates and records the full legacy baseline for a fresh database", () => {
    const dbPath = temporaryDatabasePath();
    const migrations = queryFile<{ version: number; name: string }>(
      dbPath,
      "SELECT version, name FROM schema_migrations",
    );
    const tables = queryFile<{ count: number }>(
      dbPath,
      `SELECT COUNT(*) AS count
       FROM sqlite_master
       WHERE type = 'table' AND name IN (
         'local_users', 'local_sessions', 'local_companies', 'local_company_users', 'local_jobs',
         'local_applications', 'local_saved_jobs', 'sandbox_state', 'sandbox_versions',
         'sandbox_named_resume_versions', 'sandbox_resume_revisions', 'sandbox_active_resume_version',
         'sandbox_proposals', 'sandbox_audit', 'sandbox_ai_interactions', 'sandbox_resume_imports',
         'audit_events'
       )`,
    );

    expect(migrations).toEqual([
      { version: 1, name: "baseline" },
      { version: 2, name: "integrity" },
      { version: 3, name: "criteria" },
      { version: 4, name: "application_lock" },
    ]);
    expect(tables[0]?.count).toBe(17);
  });

  it("permits multi-organization membership and keeps published criteria immutable", () => {
    const dbPath = temporaryDatabasePath();
    runFile(
      dbPath,
      `INSERT INTO local_users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["user", "member@example.test", "hash", "Member", "Example", "Member Example", "EMPLOYER", 0, "now", "now"],
    );
    for (const id of ["company-a", "company-b"]) {
      runFile(
        dbPath,
        `INSERT INTO local_companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, id, id, "Member Example", "member@example.test", "APPROVED", "now", "now"],
      );
      runFile(
        dbPath,
        "INSERT INTO local_company_users (id, company_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
        [`membership-${id}`, id, "user", "OWNER", "now"],
      );
    }
    expect(queryFile<{ count: number }>(dbPath, "SELECT COUNT(*) AS count FROM local_company_users")[0]?.count).toBe(2);

    runFile(
      dbPath,
      `INSERT INTO local_jobs (id, company_id, slug, title, category, job_type, shifts_json, city, state, zip, description,
       requirements, benefits, show_salary, eeo_statement, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["job", "company-a", "job", "RN", "Nursing", "FULL_TIME", "[]", "Chicago", "IL", "", "Role", "", "", 0, "", "DRAFT", "now", "now"],
    );
    runFile(
      dbPath,
      `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["set", "job", 1, "DRAFT", "STRUCTURED", "now"],
    );
    expect(() =>
      runFile(
        dbPath,
        `INSERT INTO job_criteria (id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["invalid", "set", 1, "PREFERRED_QUALIFICATION", "MANDATORY", "EVIDENCE_MAPPING", "Nice to have", "Nice to have", "now"],
      ),
    ).toThrow();

    runFile(
      dbPath,
      `INSERT INTO job_criteria (id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["criterion", "set", 1, "MINIMUM_QUALIFICATION", "MANDATORY", "EVIDENCE_MAPPING", "Experience", "Relevant experience", "now"],
    );
    runFile(dbPath, "UPDATE job_criteria_sets SET status = 'PUBLISHED' WHERE id = ?", ["set"]);
    expect(() => runFile(dbPath, "UPDATE job_criteria SET label = ? WHERE id = ?", ["Changed", "criterion"])).toThrow(
      "published criteria are immutable",
    );
  });

  it("rolls back all writes when work throws", () => {
    const dbPath = temporaryDatabasePath();
    runFile(dbPath, "CREATE TABLE entries (value TEXT NOT NULL)");

    expect(() =>
      transactionFile(dbPath, () => {
        runFile(dbPath, "INSERT INTO entries (value) VALUES (?)", ["first"]);
        throw new Error("abort");
      }),
    ).toThrow("abort");

    expect(queryFile<{ count: number }>(dbPath, "SELECT COUNT(*) AS count FROM entries")[0]?.count).toBe(0);
  });

  it("rejects asynchronous transaction callbacks before commit", () => {
    const dbPath = temporaryDatabasePath();
    runFile(dbPath, "CREATE TABLE entries (value TEXT NOT NULL)");

    expect(() => transactionFile(dbPath, () => Promise.resolve("not permitted"))).toThrow(
      "SQLite transaction callbacks must be synchronous.",
    );
    expect(queryFile<{ count: number }>(dbPath, "SELECT COUNT(*) AS count FROM entries")[0]?.count).toBe(0);
  });
});
