import "server-only";

import { randomUUID } from "node:crypto";
import { queryOneFile, runFile } from "@/lib/db/sql";

export function retentionCutoff(retentionMonths: number, current = new Date()) {
  const cutoff = new Date(current);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - Math.max(36, retentionMonths));
  return cutoff.toISOString();
}

export function getRetentionPolicy(dbPath: string, companyId: string) {
  const policy = queryOneFile<{ retention_months: number }>(
    dbPath,
    "SELECT retention_months FROM retention_policies WHERE company_id = ?",
    [companyId],
  );
  return { retentionMonths: Math.max(36, Number(policy?.retention_months ?? 36)) };
}

/** This is a recorded request, not immediate erasure; legal holds and retention obligations are reviewed before execution. */
export function requestAccountDeletion(dbPath: string, userId: string) {
  const existing = queryOneFile<{ id: string; state: string }>(
    dbPath,
    "SELECT id, state FROM account_deletion_requests WHERE user_id = ?",
    [userId],
  );
  if (existing) return { id: existing.id, state: existing.state, created: false as const };
  const id = randomUUID();
  runFile(
    dbPath,
    `INSERT INTO account_deletion_requests (id, user_id, state, requested_at)
     VALUES (?, ?, 'REQUESTED', ?)`,
    [id, userId, new Date().toISOString()],
  );
  return { id, state: "REQUESTED" as const, created: true as const };
}
