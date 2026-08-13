import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/http/csrf";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { evaluationDbPath } from "@/lib/evaluation/route-auth";
import { requestAccountDeletion } from "@/lib/retention/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  try {
    await assertCsrf(request);
    return NextResponse.json({ deletionRequest: requestAccountDeletion(evaluationDbPath(), user.id) }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "A valid same-origin CSRF token is required." }, { status: 403 });
  }
}
