import { NextResponse } from "next/server";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { createSandboxNamedVersion } from "@/lib/sqlite-sandbox";
import type { SandboxResumeVersionStatus } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeStatus(value: unknown): SandboxResumeVersionStatus {
  return value === "ACTIVE" || value === "ARCHIVED" ? value : "DRAFT";
}

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    purpose?: unknown;
    status?: unknown;
    source?: unknown;
  } | null;

  if (typeof body?.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Version title is required" }, { status: 400 });
  }

  return NextResponse.json(
    createSandboxNamedVersion(
      {
        title: body.title,
        purpose: typeof body.purpose === "string" ? body.purpose : undefined,
        status: normalizeStatus(body.status),
        source: body.source === "blank" ? "blank" : "current",
      },
      sandboxIdForUser(user.id),
    ),
  );
}
