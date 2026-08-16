import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCriterion,
  CriteriaAuthoringError,
  deleteCriterion,
  listCriteriaForJob,
  publishCriteriaSet,
  reviseCriteriaSet,
  updateCriterion,
  type CriterionAuthoringInput,
} from "../lib/criteria/authoring";
import { queryFile, runFile } from "../lib/db/sql";
import type { EmployerActor } from "../lib/evaluation/persistence";

function temporaryDatabasePath() {
  return join(mkdtempSync(join(tmpdir(), "careersrx-criteria-authoring-test-")), "test.sqlite");
}

function seedAuthoringCase(dbPath: string) {
  const now = "2026-08-13T00:00:00.000Z";
  runFile(
    dbPath,
    `INSERT INTO local_users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["employer", "employer@example.test", "hash", "Employer", "User", "Employer User", "EMPLOYER", 0, now, now],
  );
  runFile(
    dbPath,
    `INSERT INTO local_companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["company", "Example Care", "example-care", "Employer User", "employer@example.test", "APPROVED", now, now],
  );
  runFile(
    dbPath,
    "INSERT INTO local_company_users (id, company_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ["membership", "company", "employer", "OWNER", now],
  );
  runFile(
    dbPath,
    `INSERT INTO local_jobs (id, company_id, slug, title, category, job_type, shifts_json, city, state, zip, description,
       requirements, benefits, show_salary, eeo_statement, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["job", "company", "rn", "RN", "Nursing", "FULL_TIME", "[]", "Chicago", "IL", "", "Role", "", "", 0, "", "DRAFT", now, now],
  );
  runFile(
    dbPath,
    `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
     VALUES (?, ?, ?, 'DRAFT', 'UNSTRUCTURED', ?)`,
    ["criteria", "job", 1, now],
  );
  return { companyId: "company", companyUserId: "membership", userId: "employer" } satisfies EmployerActor;
}

const licenseCriterion: CriterionAuthoringInput = {
  kind: "HARD_ELIGIBILITY",
  disposition: "MANDATORY",
  evaluationMode: "DETERMINISTIC",
  label: "Active RN license",
  statement: "Hold an active registered nursing license.",
  ruleTemplateId: "LICENSE_ATTESTATION",
  deterministicRule: { type: "license_held", name: "Registered Nurse", state: "IL" },
  autoEnforceable: true,
};

describe("criteria authoring", () => {
  it("authors a structured draft, publishes it immutably, and revisions clone the locked version", () => {
    const dbPath = temporaryDatabasePath();
    const actor = seedAuthoringCase(dbPath);
    const first = createCriterion(dbPath, actor, "criteria", licenseCriterion);
    expect(first.autoEnforceable).toBe(true);
    expect(listCriteriaForJob(dbPath, actor, "job")[0]).toMatchObject({ authoringState: "STRUCTURED", criteria: [{ id: first.id }] });

    const published = publishCriteriaSet(dbPath, actor, "criteria");
    expect(published).toMatchObject({ status: "PUBLISHED", publishedByUserId: "employer" });
    expect(() => updateCriterion(dbPath, actor, "criteria", first.id, { label: "Changed" })).toThrow("Published criteria are immutable");
    expect(() => deleteCriterion(dbPath, actor, "criteria", first.id)).toThrow("Published criteria are immutable");

    const revision = reviseCriteriaSet(dbPath, actor, "criteria");
    expect(revision).toMatchObject({ version: 2, status: "DRAFT", authoringState: "STRUCTURED" });
    expect(revision.criteria).toHaveLength(1);
    const revisedCriterion = updateCriterion(dbPath, actor, revision.id, revision.criteria[0]!.id, { label: "Current RN license" });
    expect(revisedCriterion.label).toBe("Current RN license");

    publishCriteriaSet(dbPath, actor, revision.id);
    expect(queryFile<{ id: string; status: string; superseded_by_set_id: string | null }>(
      dbPath,
      "SELECT id, status, superseded_by_set_id FROM job_criteria_sets ORDER BY version",
    )).toEqual([
      { id: "criteria", status: "SUPERSEDED", superseded_by_set_id: revision.id },
      { id: revision.id, status: "PUBLISHED", superseded_by_set_id: null },
    ]);
  });

  it("rejects protected traits, proxies, and rule/registry combinations outside the authoring policy", () => {
    const dbPath = temporaryDatabasePath();
    const actor = seedAuthoringCase(dbPath);
    expect(() => createCriterion(dbPath, actor, "criteria", { ...licenseCriterion, statement: "Candidates must be Christian." }))
      .toThrow(CriteriaAuthoringError);
    expect(() => createCriterion(dbPath, actor, "criteria", { ...licenseCriterion, label: "Neighborhood fit" }))
      .toThrow("protected-trait proxy");
    expect(() => createCriterion(dbPath, actor, "criteria", {
      ...licenseCriterion,
      ruleTemplateId: undefined,
      autoEnforceable: true,
    })).toThrow("Auto-enforcement is limited");
    expect(() => createCriterion(dbPath, actor, "criteria", {
      ...licenseCriterion,
      label: "Age requirement",
      statement: "Candidates must be at least 30 years old.",
    })).toThrow("may not target age");
  });
});
