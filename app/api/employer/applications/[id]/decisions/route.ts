import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/evaluation/http";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";
import { recordEmployerDecision } from "@/lib/evaluation/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const requestSchema = z.object({
  evaluationId: z.string().uuid().optional(),
  decision: z.enum(["ADVANCE", "DO_NOT_ADVANCE", "REQUEST_MORE_INFO"]),
  reasonCategory: z.enum([
    "MANDATORY_CRITERION_NOT_MET", "EVIDENCE_INSUFFICIENT_AFTER_REVIEW", "HUMAN_JUDGMENT_CRITERION_NOT_MET",
    "STRONGER_CANDIDATE_POOL", "POSITION_CLOSED", "ROLE_FILLED", "BUSINESS_NEED_CHANGED", "APPLICANT_UNRESPONSIVE",
  ]).optional(),
  findingIds: z.array(z.string().uuid()).max(100).optional(),
  humanAssessmentIds: z.array(z.string().uuid()).max(100).optional(),
  hiringRoundId: z.string().uuid().optional(),
  internalNote: z.string().trim().max(4000).optional(),
  supersedesDecisionId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid decision request" }, { status: 400 });
    const { id } = await routeContext.params;
    return NextResponse.json({ decision: recordEmployerDecision(evaluationDbPath(), actor, { applicationId: id, ...parsed.data }) }, { status: 201 });
  });
}
