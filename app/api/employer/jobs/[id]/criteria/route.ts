import { NextResponse } from "next/server";
import { listCriteriaForJob } from "@/lib/criteria/authoring";
import { withApiHandler } from "@/lib/evaluation/http";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const { id } = await routeContext.params;
    return NextResponse.json({ criteriaSets: listCriteriaForJob(evaluationDbPath(), actor, id) });
  });
}
