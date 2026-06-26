import { NextResponse } from "next/server";
import { authenticateLocalUser, createLocalSession, sessionCookieOptions } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = authenticateLocalUser(body.email, body.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const session = createLocalSession(user.id);
  const response = NextResponse.json({ user });
  response.cookies.set({
    ...sessionCookieOptions(session.expiresAt),
    value: session.token,
  });
  return response;
}
