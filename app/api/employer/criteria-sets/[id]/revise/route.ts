import { NextResponse } from "next/server";
import { reviseCriteriaSet } from "@/lib/criteria/authoring";
import { withApiHandler } from "@/lib/evaluation/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const { id } = await routeContext.params;
    return NextResponse.json({ criteriaSet: await reviseCriteriaSet(actor, id) }, { status: 201 });
  });
}
