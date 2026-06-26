import { NextResponse } from "next/server";
import { createSandboxNamedVersion } from "@/lib/sqlite-sandbox";
import type { SandboxResumeVersionStatus } from "@/lib/sandbox-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeStatus(value: unknown): SandboxResumeVersionStatus {
  return value === "ACTIVE" || value === "ARCHIVED" ? value : "DRAFT";
}

export async function POST(request: Request) {
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
    createSandboxNamedVersion({
      title: body.title,
      purpose: typeof body.purpose === "string" ? body.purpose : undefined,
      status: normalizeStatus(body.status),
      source: body.source === "blank" ? "blank" : "current",
    }),
  );
}
