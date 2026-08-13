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

    expect(migrations).toEqual([{ version: 1, name: "baseline" }]);
    expect(tables[0]?.count).toBe(17);
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
