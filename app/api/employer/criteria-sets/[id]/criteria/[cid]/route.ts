import { NextResponse } from "next/server";
import { deleteCriterion, updateCriterion, type CriterionPatchInput } from "@/lib/criteria/authoring";
import { withApiHandler } from "@/lib/evaluation/http";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; cid: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Criterion update must be a JSON object", code: "INVALID_INPUT" }, { status: 422 });
    }
    const { id, cid } = await routeContext.params;
    const criterion = updateCriterion(evaluationDbPath(), actor, id, cid, body as CriterionPatchInput);
    return NextResponse.json({ criterion });
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const { id, cid } = await routeContext.params;
    deleteCriterion(evaluationDbPath(), actor, id, cid);
    return new NextResponse(null, { status: 204 });
  });
}
