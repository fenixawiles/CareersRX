import { NextResponse } from "next/server";
import { createLocalSeekerAccount, createLocalSession, sessionCookieOptions } from "@/lib/local-auth";
import type { LocalSignupInput } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<LocalSignupInput> | null;
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const result = createLocalSeekerAccount({
    email: body.email,
    password: body.password,
    firstName: typeof body.firstName === "string" ? body.firstName : "",
    lastName: typeof body.lastName === "string" ? body.lastName : "",
    fullName: body.fullName,
    headline: typeof body.headline === "string" ? body.headline : "",
    location: typeof body.location === "string" ? body.location : "",
    summary: typeof body.summary === "string" ? body.summary : "",
    experience: typeof body.experience === "string" ? body.experience : "",
    skills: stringArray(body.skills),
    credentials: stringArray(body.credentials),
    preferredRoles: stringArray(body.preferredRoles),
    preferredLocations: stringArray(body.preferredLocations),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const session = createLocalSession(result.user.id);
  const response = NextResponse.json({ user: result.user }, { status: 201 });
  response.cookies.set({
    ...sessionCookieOptions(session.expiresAt),
    value: session.token,
  });
  return response;
}
