import { NextResponse } from "next/server";
import { consumeAuthToken, markEmailVerified } from "@/lib/auth/verification";
import { getCurrentLocalUser, dashboardPathForUser } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Email-link landing: marks the account verified and forwards to the right place. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const consumed = await consumeAuthToken(token, "EMAIL_VERIFICATION");
  if (!consumed) {
    return NextResponse.redirect(new URL("/login?verification=invalid", url.origin));
  }
  await markEmailVerified(consumed.userId);
  const user = await getCurrentLocalUser();
  const destination = user && user.id === consumed.userId ? `${dashboardPathForUser(user)}?verified=1` : "/login?verified=1";
  return NextResponse.redirect(new URL(destination, url.origin));
}
