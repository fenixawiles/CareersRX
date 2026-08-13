import "server-only";

import { queryFile } from "@/lib/db/sql";

export type DeidentifiedDecisionExport = { reasonCategory: string; count: number };

/** Exports de-identified, minimum-cohort aggregate records from released applicant artifacts only. */
export function deidentifiedDecisionExport(dbPath: string, companyId: string, minimumCohort = 10): DeidentifiedDecisionExport[] {
  const rows = queryFile<{ body_json: string }>(
    dbPath,
    `SELECT body_json FROM applicant_explanations WHERE company_id = ? AND released_at IS NOT NULL`,
    [companyId],
  );
  const counts = new Map<string, number>();
  for (const row of rows) {
    try {
      const body = JSON.parse(row.body_json) as { decision?: string; reasonCategory?: string | null };
      if (body.decision === "DO_NOT_ADVANCE" && body.reasonCategory) {
        counts.set(body.reasonCategory, (counts.get(body.reasonCategory) ?? 0) + 1);
      }
    } catch {
      // A malformed historical document has no place in a de-identified report.
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minimumCohort)
    .map(([reasonCategory, count]) => ({ reasonCategory, count }))
    .sort((left, right) => left.reasonCategory.localeCompare(right.reasonCategory));
}
