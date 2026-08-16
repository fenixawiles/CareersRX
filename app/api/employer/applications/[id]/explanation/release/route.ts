import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/evaluation/http";
import { releaseApplicantExplanation } from "@/lib/evaluation/persistence";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const { id } = await routeContext.params;
    return NextResponse.json({ explanation: releaseApplicantExplanation(evaluationDbPath(), actor, id) });
  });
}
