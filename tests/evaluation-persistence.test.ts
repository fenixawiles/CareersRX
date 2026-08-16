import { describe, expect, it } from "vitest";
import { freshDatabase } from "./harness";
import { query, run } from "../lib/db/sql";
import {
  completeEvaluationRun,
  EvaluationPersistenceError,
  releaseApplicantExplanation,
  recordEmployerDecision,
  recordEvaluationFindings,
  startEvaluationRun,
  type EmployerActor,
} from "../lib/evaluation/persistence";
import { getApplicantApplicationDetail, getReleasedApplicantExplanation } from "../lib/evaluation/applicant-read";
import { pseudonymizeApplication } from "../lib/retention/pseudonymize";

async function seedEvaluationCase() {
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
    "INSERT INTO company_users (id, company_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ["membership", "company", "employer", "OWNER", now],
  );
  await run(
    `INSERT INTO jobs (id, company_id, slug, title, category, job_type, shifts_json, city, state, zip, description,
       requirements, benefits, show_salary, eeo_statement, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ["job", "company", "rn", "RN", "Nursing", "FULL_TIME", "[]", "Chicago", "IL", "", "Role", "", "", 0, "", "ACTIVE", now, now],
  );
  await run(
    `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
     VALUES (?, ?, ?, 'DRAFT', 'STRUCTURED', ?)`,
    ["criteria", "job", 1, now],
  );
  await run(
    `INSERT INTO job_criteria (
       id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement,
       rule_template_id, requires_human_review, auto_enforceable, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "license", "criteria", 1, "HARD_ELIGIBILITY", "MANDATORY", "DETERMINISTIC", "License", "Current nursing license", "LICENSE_ATTESTATION", 0, 1, now,
      "experience", "criteria", 2, "MINIMUM_QUALIFICATION", "MANDATORY", "EVIDENCE_MAPPING", "Experience", "Relevant clinical experience", null, 0, 0, now,
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
      "application", "job", "seeker", "Seeker User", "seeker@example.test", "RN", "Chicago", "", 1,
      JSON.stringify({ summary: "Registered nurse" }), JSON.stringify({ summary: "Five years of clinical experience" }),
      "criteria", null, "snapshot-hash", now, "NOT_STARTED", "SUBMITTED", "NONE", "PENDING", now, now,
    ],
  );
  return { companyId: "company", companyUserId: "membership", userId: "employer" } satisfies EmployerActor;
}

describe("evaluation persistence", () => {
  it("stores a scoped run, downgrades an unsupported model satisfaction, and locks it when a grounded decision is made", async () => {
    await freshDatabase();
    const actor = await seedEvaluationCase();
    const evaluationRun = await startEvaluationRun(actor, {
      applicationId: "application",
      evaluator: "MODEL",
      modelName: "test-model",
      modelVersion: "v1",
      promptVersion: "evaluation-prompt-v1",
      schemaVersion: "v1",
    });

    const findings = await recordEvaluationFindings(actor, evaluationRun.id, [
      {
        criterionId: "license",
        origin: "DETERMINISTIC_RULE",
        assessment: "NOT_SATISFIED",
        reasonCode: "RULE_COMPARISON",
        evidenceSource: "SELF_REPORTED",
      },
      {
        criterionId: "experience",
        origin: "MODEL",
        assessment: "SATISFIED",
        reasonCode: "RULE_COMPARISON",
        evidenceSource: "RESUME_STATED",
      },
    ]);
    expect((await query<{ assessment_state: string }>("SELECT assessment_state FROM criterion_findings WHERE criterion_id = ?", ["experience"]))[0])
      .toEqual({ assessment_state: "INSUFFICIENT_EVIDENCE" });

    await completeEvaluationRun(actor, { evaluationId: evaluationRun.id, state: "COMPLETE" });
    await expect(async () => await recordEvaluationFindings(actor, evaluationRun.id, [])).rejects.toThrow(EvaluationPersistenceError);

    const decision = await recordEmployerDecision(actor, {
      applicationId: "application",
      evaluationId: evaluationRun.id,
      decision: "DO_NOT_ADVANCE",
      reasonCategory: "MANDATORY_CRITERION_NOT_MET",
      findingIds: [findings.findingIds[0]!],
    });
    expect(decision.disposition).toBe("NOT_ADVANCED");
    expect((await query<{ locked_by_decision_id: string }>("SELECT locked_by_decision_id FROM application_evaluations WHERE id = ?", [evaluationRun.id]))[0])
      .toEqual({ locked_by_decision_id: decision.id });
    expect((await query<{ current_decision_id: string; disposition_state: string }>("SELECT current_decision_id, disposition_state FROM applications WHERE id = ?", ["application"]))[0])
      .toEqual({ current_decision_id: decision.id, disposition_state: "NOT_ADVANCED" });
    expect(await query<{ type: string; recipient_user_id: string }>("SELECT type, recipient_user_id FROM notifications")).toEqual([]);
    expect((await query<{ decision_id: string; released_at: string | null; rendered_text: string }>("SELECT decision_id, released_at, rendered_text FROM applicant_explanations"))[0])
      .toEqual(expect.objectContaining({ decision_id: decision.id, released_at: null, rendered_text: expect.stringContaining("mandatory requirement") }));
    expect(await getApplicantApplicationDetail("seeker", "application")).toMatchObject({
      dispositionState: "NOT_ADVANCED",
      criteriaSet: { id: "criteria", status: "PUBLISHED", authoringState: "STRUCTURED" },
    });
    expect(await getReleasedApplicantExplanation("seeker", "application")).toBeNull();

    const released = await releaseApplicantExplanation(actor, "application");
    expect(released).toMatchObject({ releasedAt: expect.any(String), notificationId: expect.any(String) });
    expect((await query<{ type: string; recipient_user_id: string }>("SELECT type, recipient_user_id FROM notifications"))[0])
      .toEqual({ type: "DECISION_AVAILABLE", recipient_user_id: "seeker" });
    expect(await getReleasedApplicantExplanation("seeker", "application")).toEqual(expect.objectContaining({
      decisionId: decision.id,
      renderedText: expect.stringContaining("mandatory requirement"),
    }));
    await expect(async () => await run("UPDATE applicant_explanations SET rendered_text = ?", ["changed"])).rejects.toThrow(
      "applicant explanations are immutable after release",
    );
    expect((await query<{ state: string; channel: string }>("SELECT state, channel FROM notification_outbox"))[0])
      .toEqual({ state: "PENDING", channel: "EMAIL" });
    expect(await pseudonymizeApplication("application")).toBe(true);
    expect((await query<{ profile_snapshot_json: string; pseudonymized_at: string | null }>("SELECT profile_snapshot_json, pseudonymized_at FROM applications WHERE id = ?", ["application"]))[0])
      .toEqual({ profile_snapshot_json: expect.any(String), pseudonymized_at: expect.any(String) });
    expect(JSON.parse((await query<{ profile_snapshot_json: string }>("SELECT profile_snapshot_json FROM applications WHERE id = ?", ["application"]))[0]!.profile_snapshot_json))
      .toEqual({ redacted: true });
    expect(await pseudonymizeApplication("application")).toBe(false);
  });

  it("rejects ungrounded model deficiencies and cross-organization access", async () => {
    await freshDatabase();
    const actor = await seedEvaluationCase();
    const evaluationRun = await startEvaluationRun(actor, { applicationId: "application", evaluator: "MODEL" });
    await expect(async () =>
      await recordEvaluationFindings(actor, evaluationRun.id, [
        {
          criterionId: "experience",
          origin: "MODEL",
          assessment: "NOT_SATISFIED",
          reasonCode: "NO_MATCHING_CONTENT",
          evidenceSource: "RESUME_STATED",
        },
      ]),
    ).rejects.toThrow("A model cannot record an applicant deficiency.");
    await expect(async () => await startEvaluationRun({ ...actor, companyId: "another-company" }, { applicationId: "application", evaluator: "SYSTEM" }))
      .rejects.toThrow("active organization membership");
  });
});
