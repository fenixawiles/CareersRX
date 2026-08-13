import "server-only";

import { randomUUID } from "node:crypto";
import { queryFile, queryOneFile, runFile, transactionFile } from "@/lib/db/sql";
import { getRetentionPolicy, retentionCutoff } from "@/lib/retention/policy";
import { pseudonymizeApplication } from "@/lib/retention/pseudonymize";

export function runRetentionSweep(dbPath: string, companyId: string, limit = 100) {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 500));
  return transactionFile(dbPath, () => {
    const { retentionMonths } = getRetentionPolicy(dbPath, companyId);
    const cutoff = retentionCutoff(retentionMonths);
    const candidates = queryFile<{ id: string }>(
      dbPath,
      `SELECT application.id
       FROM local_applications application JOIN local_jobs job ON job.id = application.job_id
       WHERE job.company_id = ? AND application.submitted_at < ? AND application.legal_hold = 0
         AND application.pseudonymized_at IS NULL
         AND application.disposition_state IN ('NOT_ADVANCED', 'WITHDRAWN', 'CLOSED')
       ORDER BY application.submitted_at ASC LIMIT ?`,
      [companyId, cutoff, safeLimit],
    );
    const legalHold = queryOneFile<{ count: number }>(
      dbPath,
      `SELECT COUNT(*) AS count FROM local_applications application JOIN local_jobs job ON job.id = application.job_id
       WHERE job.company_id = ? AND application.legal_hold = 1`,
      [companyId],
    );
    const startedAt = new Date().toISOString();
    let pseudonymizedCount = 0;
    for (const candidate of candidates) if (pseudonymizeApplication(dbPath, candidate.id)) pseudonymizedCount += 1;
    const completedAt = new Date().toISOString();
    const id = randomUUID();
    runFile(
      dbPath,
      `INSERT INTO retention_sweeps (
        id, company_id, state, retention_months, candidate_count, pseudonymized_count,
        legal_hold_count, started_at, completed_at
      ) VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)`,
      [id, companyId, retentionMonths, candidates.length, pseudonymizedCount, Number(legalHold?.count ?? 0), startedAt, completedAt],
    );
    runFile(
      dbPath,
      `INSERT INTO audit_events (id, event_type, actor_kind, actor_user_id, entity_type, entity_id, company_id, metadata_json, created_at)
       VALUES (?, 'RETENTION_SWEEP_COMPLETED', 'SYSTEM', NULL, 'RETENTION_SWEEP', ?, ?, ?, ?)`,
      [randomUUID(), id, companyId, JSON.stringify({ candidateCount: candidates.length, pseudonymizedCount, legalHoldCount: Number(legalHold?.count ?? 0) }), completedAt],
    );
    return { id, candidateCount: candidates.length, pseudonymizedCount, legalHoldCount: Number(legalHold?.count ?? 0), cutoff };
  });
}
