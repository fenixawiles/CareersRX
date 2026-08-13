import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/evaluation/http";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";
import { completeEvaluationRun } from "@/lib/evaluation/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const requestSchema = z.object({
  state: z.enum(["COMPLETE", "PARTIAL_DETERMINISTIC", "FAILED"]),
  errorCode: z.string().trim().min(1).max(120).optional(),
  errorDetail: z.string().trim().min(1).max(1200).optional(),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid evaluation finalization request" }, { status: 400 });
    const { id } = await routeContext.params;
    return NextResponse.json({ evaluation: completeEvaluationRun(evaluationDbPath(), actor, { evaluationId: id, ...parsed.data }) });
  });
}
