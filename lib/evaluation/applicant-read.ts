import "server-only";

import { queryOneFile } from "@/lib/db/sql";

export type ApplicantApplicationDetail = {
  id: string;
  jobId: string;
  submittedAt: string;
  evaluationState: string;
  dispositionState: string;
  status: string;
  currentDecisionId: string | null;
  criteriaSet: {
    id: string;
    version: number;
    status: "PUBLISHED" | "SUPERSEDED";
    authoringState: "STRUCTURED" | "UNSTRUCTURED";
    publishedAt: string | null;
  };
};

export type ReleasedApplicantExplanation = {
  id: string;
  applicationId: string;
  decisionId: string | null;
  criteriaSetId: string;
  body: Record<string, unknown>;
  renderedText: string;
  generatedAt: string;
  releasedAt: string;
};

export function getApplicantApplicationDetail(dbPath: string, seekerUserId: string, applicationId: string): ApplicantApplicationDetail | null {
  const row = queryOneFile<{
    id: string; job_id: string; submitted_at: string; evaluation_state: string; disposition_state: string; status: string;
    current_decision_id: string | null; criteria_set_id: string; version: number; criteria_status: "PUBLISHED" | "SUPERSEDED";
    authoring_state: "STRUCTURED" | "UNSTRUCTURED"; published_at: string | null;
  }>(
    dbPath,
    `SELECT application.id, application.job_id, application.submitted_at, application.evaluation_state,
            application.disposition_state, application.status, application.current_decision_id, application.criteria_set_id,
            criteria_set.version, criteria_set.status AS criteria_status, criteria_set.authoring_state, criteria_set.published_at
     FROM local_applications application
     JOIN job_criteria_sets criteria_set ON criteria_set.id = application.criteria_set_id
     WHERE application.id = ? AND application.seeker_user_id = ?`,
    [applicationId, seekerUserId],
  );
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    submittedAt: row.submitted_at,
    evaluationState: row.evaluation_state,
    dispositionState: row.disposition_state,
    status: row.status,
    currentDecisionId: row.current_decision_id,
    criteriaSet: {
      id: row.criteria_set_id,
      version: Number(row.version),
      status: row.criteria_status,
      authoringState: row.authoring_state,
      publishedAt: row.published_at,
    },
  };
}

export function getReleasedApplicantExplanation(dbPath: string, seekerUserId: string, applicationId: string): ReleasedApplicantExplanation | null {
  const row = queryOneFile<{
    id: string; application_id: string; decision_id: string | null; criteria_set_id: string; body_json: string;
    rendered_text: string; generated_at: string; released_at: string;
  }>(
    dbPath,
    `SELECT id, application_id, decision_id, criteria_set_id, body_json, rendered_text, generated_at, released_at
     FROM applicant_explanations
     WHERE application_id = ? AND applicant_user_id = ? AND released_at IS NOT NULL
     ORDER BY released_at DESC LIMIT 1`,
    [applicationId, seekerUserId],
  );
  if (!row) return null;
  try {
    return {
      id: row.id,
      applicationId: row.application_id,
      decisionId: row.decision_id,
      criteriaSetId: row.criteria_set_id,
      body: JSON.parse(row.body_json) as Record<string, unknown>,
      renderedText: row.rendered_text,
      generatedAt: row.generated_at,
      releasedAt: row.released_at,
    };
  } catch {
    return null;
  }
}
