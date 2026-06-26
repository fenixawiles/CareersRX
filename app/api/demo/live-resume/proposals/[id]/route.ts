import { NextResponse } from "next/server";
import { decideSandboxProposal } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { decision?: unknown } | null;
  const decision =
    body?.decision === "REJECT"
      ? "REJECT"
      : body?.decision === "KEEP_RESUME_ONLY"
        ? "KEEP_RESUME_ONLY"
        : "APPLY";

  return NextResponse.json(decideSandboxProposal(id, decision));
}
