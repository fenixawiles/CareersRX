import { NextResponse } from "next/server";
import {
  authenticateLocalUser,
  createLocalSession,
  dashboardPathForUser,
  sessionCookieOptions,
} from "@/lib/local-auth";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!rateLimit(`login-ip:${clientKey(request)}`, 20, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (!rateLimit(`login:${body.email.trim().toLowerCase()}`, 10, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }
  const user = await authenticateLocalUser(body.email, body.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const session = await createLocalSession(user.id);
  const response = NextResponse.json({ user, dashboardPath: dashboardPathForUser(user) });
  response.cookies.set({
    ...sessionCookieOptions(session.expiresAt),
    value: session.token,
  });
  return response;
}
