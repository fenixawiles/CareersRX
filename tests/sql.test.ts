import { describe, expect, it } from "vitest";
import { query, queryOne, run, tx } from "../lib/db/sql";
import { freshDatabase } from "./harness";

describe("Postgres data layer", () => {
  it("applies the full migration set to a fresh schema", async () => {
    await freshDatabase();
    const migrations = await query<{ version: number; name: string }>(
      "SELECT version, name FROM schema_migrations ORDER BY version",
    );
    expect(migrations).toEqual([
      { version: 1, name: "platform" },
      { version: 2, name: "resume" },
      { version: 3, name: "criteria" },
      { version: 4, name: "applications" },
      { version: 5, name: "evaluation" },
      { version: 6, name: "notifications" },
      { version: 7, name: "retention" },
    ]);
    const tables = await queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name IN (
         'users', 'sessions', 'tokens', 'companies', 'company_users', 'jobs', 'applications',
         'saved_jobs', 'seeker_profiles', 'resumes', 'resume_sections', 'job_criteria_sets',
         'job_criteria', 'application_evaluations', 'criterion_findings', 'employer_decisions',
         'applicant_explanations', 'audit_events', 'notifications', 'notification_outbox'
       )`,
    );
    expect(Number(tables?.count)).toBe(20);
  });

  it("permits multi-organization membership and keeps published criteria immutable", async () => {
    await freshDatabase();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
       VALUES ('user', 'user@example.com', 'hash', 'A', 'B', 'A B', 'EMPLOYER', FALSE, ?, ?)`,
      [now, now],
    );
    for (const company of ["first", "second"]) {
      await run(
        `INSERT INTO companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at)
         VALUES (?, ?, ?, 'A', 'user@example.com', 'APPROVED', ?, ?)`,
        [company, company, company, now, now],
      );
      await run(
        "INSERT INTO company_users (id, company_id, user_id, role, created_at) VALUES (?, ?, 'user', 'OWNER', ?)",
        [`membership-${company}`, company, now],
      );
    }
    const memberships = await queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM company_users WHERE user_id = 'user'",
    );
    expect(Number(memberships?.count)).toBe(2);

    await run(
      `INSERT INTO jobs (id, company_id, slug, title, category, job_type, shifts_json, city, state, zip, description,
        requirements, benefits, show_salary, eeo_statement, status, created_at, updated_at)
       VALUES ('job', 'first', 'job', 'RN', 'Nursing', 'FULL_TIME', '["DAY"]', 'Tampa', 'FL', '', 'd', '', '', TRUE, 'eeo', 'ACTIVE', ?, ?)`,
      [now, now],
    );
    await run(
      `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
       VALUES ('set', 'job', 1, 'DRAFT', 'STRUCTURED', ?)`,
      [now],
    );
    await run(
      `INSERT INTO job_criteria (id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement, created_at)
       VALUES ('criterion', 'set', 1, 'MINIMUM_QUALIFICATION', 'MANDATORY', 'DETERMINISTIC', 'License', 'Holds a license', ?)`,
      [now],
    );
    await run("UPDATE job_criteria_sets SET status = 'PUBLISHED', published_at = ? WHERE id = 'set'", [now]);

    await expect(run("UPDATE job_criteria SET label = 'Changed' WHERE id = 'criterion'")).rejects.toThrow(
      "published criteria are immutable",
    );
    await expect(
      run(
        `INSERT INTO job_criteria (id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement, created_at)
         VALUES ('late', 'set', 2, 'MINIMUM_QUALIFICATION', 'MANDATORY', 'DETERMINISTIC', 'Late', 'Added after publish', ?)`,
        [new Date().toISOString()],
      ),
    ).rejects.toThrow("published criteria are immutable");
  });

  it("rolls back all writes when work throws", async () => {
    await freshDatabase();
    const now = new Date().toISOString();
    await expect(
      tx(async () => {
        await run(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, created_at, updated_at)
           VALUES ('rollback', 'rollback@example.com', 'hash', 'A', 'B', 'A B', 'SEEKER', ?, ?)`,
          [now, now],
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const user = await queryOne<{ id: string }>("SELECT id FROM users WHERE id = 'rollback'");
    expect(user).toBeNull();
  });

  it("nests transactions with savepoints so an inner failure does not lose outer work", async () => {
    await freshDatabase();
    const now = new Date().toISOString();
    await tx(async () => {
      await run(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, created_at, updated_at)
         VALUES ('outer', 'outer@example.com', 'hash', 'A', 'B', 'A B', 'SEEKER', ?, ?)`,
        [now, now],
      );
      await expect(
        tx(async () => {
          await run(
            `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, created_at, updated_at)
             VALUES ('inner', 'inner@example.com', 'hash', 'A', 'B', 'A B', 'SEEKER', ?, ?)`,
            [now, now],
          );
          throw new Error("inner boom");
        }),
      ).rejects.toThrow("inner boom");
    });
    expect(await queryOne("SELECT id FROM users WHERE id = 'outer'")).not.toBeNull();
    expect(await queryOne("SELECT id FROM users WHERE id = 'inner'")).toBeNull();
  });
});
