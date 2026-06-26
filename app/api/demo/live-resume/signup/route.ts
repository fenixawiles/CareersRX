import { NextResponse } from "next/server";
import { createSandboxProfile } from "@/lib/sqlite-sandbox";
import type { SandboxSignupInput } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<SandboxSignupInput> | null;
  if (!body || typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json({ error: "fullName is required" }, { status: 400 });
  }

  const input: SandboxSignupInput = {
    email: typeof body.email === "string" ? body.email : "",
    fullName: body.fullName,
    headline: typeof body.headline === "string" ? body.headline : "",
    location: typeof body.location === "string" ? body.location : "",
    summary: typeof body.summary === "string" ? body.summary : "",
    experience: typeof body.experience === "string" ? body.experience : "",
    skills: stringArray(body.skills),
    credentials: stringArray(body.credentials),
    preferredRoles: stringArray(body.preferredRoles),
    preferredLocations: stringArray(body.preferredLocations),
  };

  return NextResponse.json(createSandboxProfile(input), { status: 201 });
}
