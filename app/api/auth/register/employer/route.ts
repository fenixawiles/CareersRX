import { NextResponse } from "next/server";
import {
  createLocalEmployerAccount,
  createLocalSession,
  dashboardPathForUser,
  sessionCookieOptions,
} from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    companyName?: unknown;
    contactName?: unknown;
    email?: unknown;
    password?: unknown;
  } | null;

  if (
    !body ||
    typeof body.companyName !== "string" ||
    typeof body.contactName !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "Company name, contact name, email, and password are required" },
      { status: 400 },
    );
  }

  const result = createLocalEmployerAccount({
    companyName: body.companyName,
    contactName: body.contactName,
    email: body.email,
    password: body.password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const session = createLocalSession(result.user.id);
  const response = NextResponse.json(
    { user: result.user, company: result.company, dashboardPath: dashboardPathForUser(result.user) },
    { status: 201 },
  );
  response.cookies.set({
    ...sessionCookieOptions(session.expiresAt),
    value: session.token,
  });
  return response;
}
