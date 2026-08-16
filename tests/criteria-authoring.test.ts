import { describe, expect, it } from "vitest";
import { freshDatabase } from "./harness";
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
import { query, run } from "../lib/db/sql";
import type { EmployerActor } from "../lib/evaluation/persistence";

async function seedAuthoringCase() {
  const now = "2026-08-13T00:00:00.000Z";
  await run(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["employer", "employer@example.test", "hash", "Employer", "User", "Employer User", "EMPLOYER", 0, now, now],
  );
  await run(
    `INSERT INTO companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["company", "Example Care", "example-care", "Employer User", "employer@example.test", "APPROVED", now, now],
  );
  await run(
    "INSERT INTO company_users (id, company_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ["membership", "company", "employer", "OWNER", now],
  );
  await run(
    `INSERT INTO jobs (id, company_id, slug, title, category, job_type, shifts_json, city, state, zip, description,
       requirements, benefits, show_salary, eeo_statement, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["job", "company", "rn", "RN", "Nursing", "FULL_TIME", "[]", "Chicago", "IL", "", "Role", "", "", 0, "", "DRAFT", now, now],
  );
  await run(
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
  it("authors a structured draft, publishes it immutably, and revisions clone the locked version", async () => {
    await freshDatabase();
    const actor = await seedAuthoringCase();
    const first = await createCriterion(actor, "criteria", licenseCriterion);
    expect(first.autoEnforceable).toBe(true);
    expect((await listCriteriaForJob(actor, "job"))[0]).toMatchObject({ authoringState: "STRUCTURED", criteria: [{ id: first.id }] });

    const published = await publishCriteriaSet(actor, "criteria");
    expect(published).toMatchObject({ status: "PUBLISHED", publishedByUserId: "employer" });
    await expect(async () => await updateCriterion(actor, "criteria", first.id, { label: "Changed" })).rejects.toThrow("Published criteria are immutable");
    await expect(async () => await deleteCriterion(actor, "criteria", first.id)).rejects.toThrow("Published criteria are immutable");

    const revision = await reviseCriteriaSet(actor, "criteria");
    expect(revision).toMatchObject({ version: 2, status: "DRAFT", authoringState: "STRUCTURED" });
    expect(revision.criteria).toHaveLength(1);
    const revisedCriterion = await updateCriterion(actor, revision.id, revision.criteria[0]!.id, { label: "Current RN license" });
    expect(revisedCriterion.label).toBe("Current RN license");

    await publishCriteriaSet(actor, revision.id);
    expect(await query<{ id: string; status: string; superseded_by_set_id: string | null }>(
      "SELECT id, status, superseded_by_set_id FROM job_criteria_sets ORDER BY version",
    )).toEqual([
      { id: "criteria", status: "SUPERSEDED", superseded_by_set_id: revision.id },
      { id: revision.id, status: "PUBLISHED", superseded_by_set_id: null },
    ]);
  });

  it("rejects protected traits, proxies, and rule/registry combinations outside the authoring policy", async () => {
    await freshDatabase();
    const actor = await seedAuthoringCase();
    await expect(async () => await createCriterion(actor, "criteria", { ...licenseCriterion, statement: "Candidates must be Christian." }))
      .rejects.toThrow(CriteriaAuthoringError);
    await expect(async () => await createCriterion(actor, "criteria", { ...licenseCriterion, label: "Neighborhood fit" }))
      .rejects.toThrow("protected-trait proxy");
    await expect(async () => await createCriterion(actor, "criteria", {
      ...licenseCriterion,
      ruleTemplateId: undefined,
      autoEnforceable: true,
    })).rejects.toThrow("Auto-enforcement is limited");
    await expect(async () => await createCriterion(actor, "criteria", {
      ...licenseCriterion,
      label: "Age requirement",
      statement: "Candidates must be at least 30 years old.",
    })).rejects.toThrow("may not target age");
  });
});
