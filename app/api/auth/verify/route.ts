import { NextResponse } from "next/server";
import { consumeAuthToken, markEmailVerified } from "@/lib/auth/verification";
import { getCurrentLocalUser, dashboardPathForUser } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Behind Railway's proxy, request.url carries the internal host (localhost:8080), so redirects are
 * built on the configured public origin instead.
 */
function publicOrigin(request: Request) {
  const configured = process.env.CAREERSRX_APP_URL;
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
}

/** Email-link landing: marks the account verified and forwards to the right place. */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const consumed = await consumeAuthToken(token, "EMAIL_VERIFICATION");
  if (!consumed) {
    return NextResponse.redirect(new URL("/login?verification=invalid", origin));
  }
  await markEmailVerified(consumed.userId);
  const user = await getCurrentLocalUser();
  const destination = user && user.id === consumed.userId ? `${dashboardPathForUser(user)}?verified=1` : "/login?verified=1";
  return NextResponse.redirect(new URL(destination, origin));
}
