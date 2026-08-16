import { NextResponse } from "next/server";
import { createCriterion, type CriterionAuthoringInput } from "@/lib/criteria/authoring";
import { withApiHandler } from "@/lib/evaluation/http";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Criterion input must be a JSON object", code: "INVALID_INPUT" }, { status: 422 });
    }
    const { id } = await routeContext.params;
    const criterion = createCriterion(evaluationDbPath(), actor, id, body as CriterionAuthoringInput);
    return NextResponse.json({ criterion }, { status: 201 });
  });
}
