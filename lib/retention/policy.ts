import "server-only";

import { randomUUID } from "node:crypto";
import { queryOne, run } from "@/lib/db/sql";

export function retentionCutoff(retentionMonths: number, current = new Date()) {
  const cutoff = new Date(current);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - Math.max(36, retentionMonths));
  return cutoff.toISOString();
}

export async function getRetentionPolicy(companyId: string) {
  const policy = await queryOne<{ retention_months: number }>(
    "SELECT retention_months FROM retention_policies WHERE company_id = ?",
    [companyId],
  );
  return { retentionMonths: Math.max(36, Number(policy?.retention_months ?? 36)) };
}

/** This is a recorded request, not immediate erasure; legal holds and retention obligations are reviewed before execution. */
export async function requestAccountDeletion(userId: string) {
  const existing = await queryOne<{ id: string; state: string }>(
    "SELECT id, state FROM account_deletion_requests WHERE user_id = ?",
    [userId],
  );
  if (existing) return { id: existing.id, state: existing.state, created: false as const };
  const id = randomUUID();
  await run(
    `INSERT INTO account_deletion_requests (id, user_id, state, requested_at)
     VALUES (?, ?, 'REQUESTED', ?)`,
    [id, userId, new Date().toISOString()],
  );
  return { id, state: "REQUESTED" as const, created: true as const };
}
