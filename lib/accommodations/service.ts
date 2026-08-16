import "server-only";

import { randomUUID } from "node:crypto";
import { queryOneFile, runFile, transactionFile } from "@/lib/db/sql";
import type { EmployerActor } from "@/lib/evaluation/persistence";

export class AccommodationError extends Error {
  constructor(public readonly code: "ACCESS_DENIED" | "NOT_FOUND" | "INVALID_STATE" | "INVALID_INPUT", message: string) {
    super(message);
    this.name = "AccommodationError";
  }
}

function timestamp() { return new Date().toISOString(); }

function activeActor(dbPath: string, actor: EmployerActor) {
  const member = queryOneFile<{ id: string }>(dbPath, "SELECT id FROM local_company_users WHERE id = ? AND company_id = ? AND user_id = ? AND revoked_at IS NULL AND role IN ('OWNER', 'ADMIN', 'RECRUITER')", [actor.companyUserId, actor.companyId, actor.userId]);
  if (!member) throw new AccommodationError("ACCESS_DENIED", "An active organization membership is required.");
}

export function requestAccommodation(dbPath: string, seekerUserId: string, applicationId: string, requestText: string) {
  return transactionFile(dbPath, () => {
    if (!requestText.trim() || requestText.trim().length > 4_000) throw new AccommodationError("INVALID_INPUT", "Accommodation request text is required and must be under 4,000 characters.");
    const application = queryOneFile<{ id: string }>(dbPath, "SELECT id FROM local_applications WHERE id = ? AND seeker_user_id = ?", [applicationId, seekerUserId]);
    if (!application) throw new AccommodationError("NOT_FOUND", "Application not found.");
    const open = queryOneFile<{ id: string }>(dbPath, "SELECT id FROM accommodation_requests WHERE application_id = ? AND state IN ('REQUESTED', 'IN_PROGRESS')", [applicationId]);
    if (open) throw new AccommodationError("INVALID_STATE", "An accommodation request is already open for this application.");
    const id = randomUUID();
    const requestedAt = timestamp();
    runFile(dbPath, "INSERT INTO accommodation_requests (id, application_id, requested_at, request_text, state) VALUES (?, ?, ?, ?, 'REQUESTED')", [id, applicationId, requestedAt, requestText.trim()]);
    runFile(dbPath, "UPDATE local_applications SET accommodation_state = 'REQUESTED', updated_at = ? WHERE id = ?", [requestedAt, applicationId]);
    return { id, state: "REQUESTED" as const, requestedAt };
  });
}

export function triageAccommodation(dbPath: string, actor: EmployerActor, requestId: string, input: { state: "IN_PROGRESS" | "PROVIDED" | "DECLINED"; resolutionNote?: string; affectedCriterionIds?: string[] }) {
  return transactionFile(dbPath, () => {
    activeActor(dbPath, actor);
    const request = queryOneFile<{ application_id: string; criteria_set_id: string }>(
      dbPath,
      `SELECT request.application_id, application.criteria_set_id FROM accommodation_requests request
       JOIN local_applications application ON application.id = request.application_id
       JOIN local_jobs job ON job.id = application.job_id
       WHERE request.id = ? AND job.company_id = ?`, [requestId, actor.companyId],
    );
    if (!request) throw new AccommodationError("NOT_FOUND", "Accommodation request not found for this organization.");
    const affected = input.affectedCriterionIds ?? [];
    if (new Set(affected).size !== affected.length) throw new AccommodationError("INVALID_INPUT", "Affected criteria cannot contain duplicates.");
    for (const criterionId of affected) {
      const criterion = queryOneFile<{ id: string }>(dbPath, "SELECT id FROM job_criteria WHERE id = ? AND criteria_set_id = ?", [criterionId, request.criteria_set_id]);
      if (!criterion) throw new AccommodationError("INVALID_INPUT", "Affected criteria must belong to the application's locked criteria set.");
      runFile(dbPath, "INSERT OR IGNORE INTO accommodation_affected_criteria (request_id, criterion_id) VALUES (?, ?)", [requestId, criterionId]);
    }
    const handledAt = timestamp();
    runFile(dbPath, "UPDATE accommodation_requests SET state = ?, handled_by_user_id = ?, handled_at = ?, resolution_note = ? WHERE id = ?", [input.state, actor.userId, handledAt, input.resolutionNote?.trim() || null, requestId]);
    runFile(dbPath, "UPDATE local_applications SET accommodation_state = ?, updated_at = ? WHERE id = ?", [input.state, handledAt, request.application_id]);
    return { id: requestId, state: input.state, handledAt };
  });
}
