import { NextResponse } from "next/server";
import { findUserByEmailForReset, sendPasswordResetEmail } from "@/lib/auth/verification";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Always answers 200 so the endpoint cannot be used to probe which emails have accounts. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 320) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!rateLimit(`reset-request:${email}`, 3, 60 * 60 * 1000).allowed || !rateLimit(`reset-request-ip:${clientKey(request)}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ ok: true });
  }
  const user = await findUserByEmailForReset(email);
  if (user) await sendPasswordResetEmail(user);
  return NextResponse.json({ ok: true });
}
