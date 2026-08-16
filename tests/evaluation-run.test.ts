import { describe, expect, it } from "vitest";
import { freshDatabase } from "./harness";
import { query, run } from "../lib/db/sql";
import { runDeterministicEvaluationForApplication } from "../lib/evaluation/run";

async function seedStructuredApplication() {
  const now = "2026-08-13T00:00:00.000Z";
  await run(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "employer", "employer@example.test", "hash", "Employer", "User", "Employer User", "EMPLOYER", 0, now, now,
      "seeker", "seeker@example.test", "hash", "Seeker", "User", "Seeker User", "SEEKER", 0, now, now,
    ],
  );
  await run(
    `INSERT INTO companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["company", "Example Care", "example-care", "Employer User", "employer@example.test", "APPROVED", now, now],
  );
  await run(
    `INSERT INTO jobs (id, company_id, slug, title, category, job_type, shifts_json, city, state, zip, description,
       requirements, benefits, show_salary, eeo_statement, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["job", "company", "rn", "RN", "Nursing", "FULL_TIME", "[]", "Chicago", "IL", "", "Role", "", "", 0, "", "ACTIVE", now, now],
  );
  await run(
    `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
     VALUES (?, ?, 1, 'DRAFT', 'STRUCTURED', ?)`,
    ["criteria", "job", now],
  );
  await run(
    `INSERT INTO job_criteria (
      id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement,
      rule_template_id, deterministic_rule_json, requires_human_review, auto_enforceable, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "license", "criteria", 1, "HARD_ELIGIBILITY", "MANDATORY", "DETERMINISTIC", "License", "Current nursing license",
      "LICENSE_ATTESTATION", JSON.stringify({ type: "license_held", name: "Registered Nurse", state: "IL" }), 0, 1, now,
      "experience", "criteria", 2, "MINIMUM_QUALIFICATION", "MANDATORY", "EVIDENCE_MAPPING", "Experience", "Relevant clinical experience",
      null, null, 0, 0, now,
    ],
  );
  await run("UPDATE job_criteria_sets SET status = 'PUBLISHED', published_at = ? WHERE id = ?", [now, "criteria"]);
  await run(
    `INSERT INTO applications (
      id, job_id, seeker_user_id, seeker_name, seeker_email, seeker_headline, seeker_location,
      cover_letter, license_confirmed, profile_snapshot_json, resume_snapshot_json, criteria_set_id,
      resume_revision_id, snapshot_hash, submitted_at, evaluation_state, disposition_state,
      accommodation_state, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "application", "job", "seeker", "Seeker User", "seeker@example.test", "RN", "Chicago, IL", "", 1,
      JSON.stringify({ licenses: [{ name: "Registered Nurse", state: "IL" }], location: "Chicago, IL" }), JSON.stringify({}),
      "criteria", null, "snapshot-hash", now, "NOT_STARTED", "SUBMITTED", "NONE", "PENDING", now, now,
    ],
  );
}

describe("deterministic evaluation run", () => {
  it("persists deterministic findings but leaves evidence-mapping criteria for later review", async () => {
    await freshDatabase();
    await seedStructuredApplication();

    const result = await runDeterministicEvaluationForApplication("application");
    expect(result).toMatchObject({ state: "PARTIAL_DETERMINISTIC", findingCount: 1 });
    expect(await query<{ criterion_id: string; assessment_state: string; finding_origin: string }>(
      "SELECT criterion_id, assessment_state, finding_origin FROM criterion_findings ORDER BY criterion_id",
    )).toEqual([{ criterion_id: "license", assessment_state: "SATISFIED", finding_origin: "DETERMINISTIC_RULE" }]);
    expect(await query<{ criterion_id: string }>("SELECT criterion_id FROM criterion_findings WHERE criterion_id = ?", ["experience"])).toEqual([]);
    expect(await query<{ evaluation_state: string }>("SELECT evaluation_state FROM applications WHERE id = ?", ["application"])).toEqual([
      { evaluation_state: "PARTIAL_DETERMINISTIC" },
    ]);
  });
});
