import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiHandler } from "@/lib/evaluation/http";
import { recordEvaluationFindings } from "@/lib/evaluation/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const evidenceSchema = z.object({
  snapshotField: z.string().trim().min(1).max(200),
  excerpt: z.string().min(1).max(4000),
  charStart: z.number().int().min(0),
  charEnd: z.number().int().min(0),
  claimPolarity: z.enum(["SUPPORTS", "CONTRADICTS", "AMBIGUOUS"]),
}).strict();
const findingSchema = z.object({
  criterionId: z.string().uuid(),
  origin: z.enum(["DETERMINISTIC_RULE", "MODEL"]),
  assessment: z.enum(["SATISFIED", "NOT_SATISFIED", "INSUFFICIENT_EVIDENCE", "REQUIRES_HUMAN_JUDGMENT"]),
  confidence: z.number().min(0).max(1).optional(),
  reasonCode: z.enum(["NO_MATCHING_CONTENT", "CONTENT_AMBIGUOUS", "EVIDENCE_CONTRADICTED", "REQUIRES_CREDENTIAL_CHECK", "REQUIRES_HUMAN_INTERPRETATION", "RULE_COMPARISON"]),
  reasoningNote: z.string().trim().max(1200).optional(),
  evidenceSource: z.enum(["SELF_REPORTED", "RESUME_STATED", "VERIFIED"]),
  evidence: z.array(evidenceSchema).max(12).optional(),
}).strict();
const requestSchema = z.object({ findings: z.array(findingSchema).min(1).max(100) }).strict();

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(request, context, async ({ actor, context: routeContext }) => {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid findings request" }, { status: 400 });
    const { id } = await routeContext.params;
    return NextResponse.json({ result: await recordEvaluationFindings(actor, id, parsed.data.findings) }, { status: 201 });
  });
}
