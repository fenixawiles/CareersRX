import { NextResponse } from "next/server";
import { requestAccommodation } from "@/lib/accommodations/service";
import { getCurrentLocalUser } from "@/lib/local-auth";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.role !== "SEEKER") return NextResponse.json({ error: "Job seeker account required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { requestText?: unknown } | null;
  if (!body || typeof body.requestText !== "string") return NextResponse.json({ error: "Accommodation request text is required" }, { status: 422 });
  try { const { id } = await context.params; return NextResponse.json({ request: await requestAccommodation(user.id, id, body.requestText) }, { status: 201 }); }
  catch (error) { const status = error instanceof Error && error.name === "AccommodationError" ? 422 : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to file accommodation request" }, { status }); }
}
