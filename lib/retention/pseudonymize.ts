import "server-only";

import { createHash } from "node:crypto";
import { queryOne, run } from "@/lib/db/sql";

const REDACTED_SNAPSHOT = '{"redacted":true}';

function redactedSnapshotHash() {
  return createHash("sha256").update(`${REDACTED_SNAPSHOT}\n${REDACTED_SNAPSHOT}`).digest("hex");
}

/** Retains the application shell and append-only history while irreversibly removing its stored PII. */
export async function pseudonymizeApplication(applicationId: string) {
  const application = await queryOne<{ id: string; legal_hold: number; pseudonymized_at: string | null }>(
    "SELECT id, legal_hold, pseudonymized_at FROM applications WHERE id = ?",
    [applicationId],
  );
  if (!application || Number(application.legal_hold) === 1 || application.pseudonymized_at) return false;
  const timestamp = new Date().toISOString();
  const result = await run(
    `UPDATE applications
     SET seeker_name = 'Deleted applicant', seeker_email = ?, seeker_headline = '', seeker_location = '',
         cover_letter = '', profile_snapshot_json = ?, resume_snapshot_json = ?, snapshot_hash = ?,
         pseudonymized_at = ?, updated_at = ?
     WHERE id = ? AND NOT legal_hold AND pseudonymized_at IS NULL`,
    [`deleted-${application.id}@invalid`, REDACTED_SNAPSHOT, REDACTED_SNAPSHOT, redactedSnapshotHash(), timestamp, timestamp, application.id],
  );
  return result.changes === 1;
}
