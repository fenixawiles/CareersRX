import "server-only";

import { queryOne } from "@/lib/db/sql";
import type { EmployerActor } from "@/lib/evaluation/persistence";
import { getCurrentLocalUser } from "@/lib/local-auth";

export type EvaluationRouteAuth =
  | { actor: EmployerActor }
  | { error: string; status: 401 | 403 };

/** Resolves the current human to an active, decision-capable organization membership. */
export async function requireEvaluationActor(): Promise<EvaluationRouteAuth> {
  const user = await getCurrentLocalUser();
  if (!user) return { error: "Log in required", status: 401 };
  if (user.role !== "EMPLOYER") return { error: "Employer account required", status: 403 };
  const membership = await queryOne<{ id: string; company_id: string }>(
    `SELECT id, company_id FROM company_users
     WHERE user_id = ? AND revoked_at IS NULL AND role IN ('OWNER', 'ADMIN', 'RECRUITER')
     ORDER BY created_at ASC LIMIT 1`,
    [user.id],
  );
  if (!membership) return { error: "An active decision-capable organization membership is required", status: 403 };
  return { actor: { userId: user.id, companyUserId: membership.id, companyId: membership.company_id } };
}
