import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/evaluation/http";
import { startEvaluationRun } from "@/lib/evaluation/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const requestSchema = z.object({
  evaluator: z.enum(["SYSTEM", "MODEL"]),
  modelName: z.string().trim().min(1).max(160).optional(),
  modelVersion: z.string().trim().min(1).max(160).optional(),
  promptVersion: z.string().trim().min(1).max(160).optional(),
  schemaVersion: z.string().trim().min(1).max(160).optional(),
}).strict();

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid evaluation request" }, { status: 400 });
    const { id } = await routeContext.params;
    const evaluation = await startEvaluationRun(actor, { applicationId: id, ...parsed.data });
    return NextResponse.json({ evaluation }, { status: 201 });
  });
}
