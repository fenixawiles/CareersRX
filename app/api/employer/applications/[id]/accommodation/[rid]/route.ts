import { NextResponse } from "next/server";
import { z } from "zod";
import { triageAccommodation } from "@/lib/accommodations/service";
import { withApiHandler } from "@/lib/evaluation/http";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string; rid: string }> };
const schema = z.object({ state: z.enum(["IN_PROGRESS", "PROVIDED", "DECLINED"]), resolutionNote: z.string().trim().max(4000).optional(), affectedCriterionIds: z.array(z.string()).max(100).optional() }).strict();
export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid accommodation triage request" }, { status: 422 });
    const { id, rid } = await routeContext.params;
    const result = await triageAccommodation(actor, rid, parsed.data);
    return NextResponse.json({ request: result, applicationId: id });
  });
}
