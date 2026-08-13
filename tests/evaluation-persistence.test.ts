import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { queryFile, runFile } from "../lib/db/sql";
import {
  completeEvaluationRun,
  EvaluationPersistenceError,
  recordEmployerDecision,
  recordEvaluationFindings,
  startEvaluationRun,
  type EmployerActor,
} from "../lib/evaluation/persistence";

function temporaryDatabasePath() {
  return join(mkdtempSync(join(tmpdir(), "careersrx-evaluation-test-")), "test.sqlite");
}

function seedEvaluationCase(dbPath: string) {
  const now = "2026-08-13T00:00:00.000Z";
  runFile(
    dbPath,
    `INSERT INTO local_users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "employer", "employer@example.test", "hash", "Employer", "User", "Employer User", "EMPLOYER", 0, now, now,
      "seeker", "seeker@example.test", "hash", "Seeker", "User", "Seeker User", "SEEKER", 0, now, now,
    ],
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
    ["job", "company", "rn", "RN", "Nursing", "FULL_TIME", "[]", "Chicago", "IL", "", "Role", "", "", 0, "", "ACTIVE", now, now],
  );
  runFile(
    dbPath,
    `INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at)
     VALUES (?, ?, ?, 'DRAFT', 'STRUCTURED', ?)`,
    ["criteria", "job", 1, now],
  );
  runFile(
    dbPath,
    `INSERT INTO job_criteria (
       id, criteria_set_id, ordinal, kind, disposition, evaluation_mode, label, statement,
       rule_template_id, requires_human_review, auto_enforceable, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "license", "criteria", 1, "HARD_ELIGIBILITY", "MANDATORY", "DETERMINISTIC", "License", "Current nursing license", "LICENSE_ATTESTATION", 0, 1, now,
      "experience", "criteria", 2, "MINIMUM_QUALIFICATION", "MANDATORY", "EVIDENCE_MAPPING", "Experience", "Relevant clinical experience", null, 0, 0, now,
    ],
  );
  runFile(dbPath, "UPDATE job_criteria_sets SET status = 'PUBLISHED', published_at = ? WHERE id = ?", [now, "criteria"]);
  runFile(
    dbPath,
    `INSERT INTO local_applications (
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
  it("stores a scoped run, downgrades an unsupported model satisfaction, and locks it when a grounded decision is made", () => {
    const dbPath = temporaryDatabasePath();
    const actor = seedEvaluationCase(dbPath);
    const run = startEvaluationRun(dbPath, actor, {
      applicationId: "application",
      evaluator: "MODEL",
      modelName: "test-model",
      modelVersion: "v1",
      promptVersion: "evaluation-prompt-v1",
      schemaVersion: "v1",
    });

    const findings = recordEvaluationFindings(dbPath, actor, run.id, [
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
    expect(queryFile<{ assessment_state: string }>(dbPath, "SELECT assessment_state FROM criterion_findings WHERE criterion_id = ?", ["experience"])[0])
      .toEqual({ assessment_state: "INSUFFICIENT_EVIDENCE" });

    completeEvaluationRun(dbPath, actor, { evaluationId: run.id, state: "COMPLETE" });
    expect(() => recordEvaluationFindings(dbPath, actor, run.id, [])).toThrow(EvaluationPersistenceError);

    const decision = recordEmployerDecision(dbPath, actor, {
      applicationId: "application",
      evaluationId: run.id,
      decision: "DO_NOT_ADVANCE",
      reasonCategory: "MANDATORY_CRITERION_NOT_MET",
      findingIds: [findings.findingIds[0]!],
    });
    expect(decision.disposition).toBe("NOT_ADVANCED");
    expect(queryFile<{ locked_by_decision_id: string }>(dbPath, "SELECT locked_by_decision_id FROM application_evaluations WHERE id = ?", [run.id])[0])
      .toEqual({ locked_by_decision_id: decision.id });
    expect(queryFile<{ current_decision_id: string; disposition_state: string }>(dbPath, "SELECT current_decision_id, disposition_state FROM local_applications WHERE id = ?", ["application"])[0])
      .toEqual({ current_decision_id: decision.id, disposition_state: "NOT_ADVANCED" });
  });

  it("rejects ungrounded model deficiencies and cross-organization access", () => {
    const dbPath = temporaryDatabasePath();
    const actor = seedEvaluationCase(dbPath);
    const run = startEvaluationRun(dbPath, actor, { applicationId: "application", evaluator: "MODEL" });
    expect(() =>
      recordEvaluationFindings(dbPath, actor, run.id, [
        {
          criterionId: "experience",
          origin: "MODEL",
          assessment: "NOT_SATISFIED",
          reasonCode: "NO_MATCHING_CONTENT",
          evidenceSource: "RESUME_STATED",
        },
      ]),
    ).toThrow("A model cannot record an applicant deficiency.");
    expect(() => startEvaluationRun(dbPath, { ...actor, companyId: "another-company" }, { applicationId: "application", evaluator: "SYSTEM" }))
      .toThrow("active organization membership");
  });
});
