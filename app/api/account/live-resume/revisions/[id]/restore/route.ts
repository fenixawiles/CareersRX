import { NextResponse } from "next/server";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { restoreSandboxRevision } from "@/lib/sqlite-sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });

  const { id } = await context.params;
  return NextResponse.json(restoreSandboxRevision(id, sandboxIdForUser(user.id)));
}
