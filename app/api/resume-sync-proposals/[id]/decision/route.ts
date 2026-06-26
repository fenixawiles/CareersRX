import { NextResponse } from "next/server";
import { getDemoSeeker } from "@/lib/demo";
import { applyProposalDecision } from "@/lib/resumes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const seeker = await getDemoSeeker();
  if (!seeker) return NextResponse.json({ error: "Demo seeker not found" }, { status: 404 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    decision?: unknown;
    scope?: unknown;
  } | null;

  const decision = body?.decision === "REJECTED" ? "REJECTED" : "ACCEPTED";
  const scope = typeof body?.scope === "string" ? body.scope : undefined;

  const result = await applyProposalDecision({
    seekerId: seeker.id,
    proposalId: id,
    decision,
    scope,
    actorId: seeker.userId,
  });

  return NextResponse.json(result);
}
