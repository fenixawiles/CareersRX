import "server-only";

import { queryFile } from "@/lib/db/sql";

type ReleasedExplanation = { body_json: string };

export type ApplicantDecisionInsight = {
  reasonCategory: string;
  count: number;
};

/**
 * The applicant insights boundary intentionally reads only released explanation bodies. It does not
 * access employer decisions, application records, evaluation findings, or any model artifacts.
 */
export function aggregateApplicantInsights(dbPath: string, applicantUserId: string) {
  const explanations = queryFile<ReleasedExplanation>(
    dbPath,
    `SELECT body_json FROM applicant_explanations
     WHERE applicant_user_id = ? AND released_at IS NOT NULL`,
    [applicantUserId],
  );
  const counts = new Map<string, number>();
  for (const row of explanations) {
    try {
      const body = JSON.parse(row.body_json) as { decision?: string; reasonCategory?: string | null };
      if (body.decision !== "DO_NOT_ADVANCE" || !body.reasonCategory) continue;
      counts.set(body.reasonCategory, (counts.get(body.reasonCategory) ?? 0) + 1);
    } catch {
      // A malformed retained artifact is omitted from an informational aggregate rather than surfaced.
    }
  }
  const reasons: ApplicantDecisionInsight[] = [...counts.entries()]
    .map(([reasonCategory, count]) => ({ reasonCategory, count }))
    .sort((left, right) => right.count - left.count || left.reasonCategory.localeCompare(right.reasonCategory));
  return {
    releasedDecisionCount: explanations.length,
    reasons,
    notice: "This is a summary of explanations already released to you. It is not a score, ranking, or prediction.",
  };
}
