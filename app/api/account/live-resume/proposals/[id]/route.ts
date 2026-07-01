import { NextResponse } from "next/server";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { decideSandboxProposal } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    decision?: unknown;
  } | null;
  const decision = body?.decision;
  if (decision !== "APPLY" && decision !== "KEEP_RESUME_ONLY" && decision !== "REJECT") {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const { id } = await context.params;
  return NextResponse.json(decideSandboxProposal(id, decision, sandboxIdForUser(user.id)));
}
