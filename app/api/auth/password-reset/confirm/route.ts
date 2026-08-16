import { NextResponse } from "next/server";
import { consumeAuthToken, markEmailVerified, resetPassword } from "@/lib/auth/verification";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!rateLimit(`reset-confirm-ip:${clientKey(request)}`, 10, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token) return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
  if (password.trim().length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const consumed = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!consumed) {
    return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
  }
  await resetPassword(consumed.userId, password);
  // Completing a reset proves control of the mailbox, which is what verification asserts.
  await markEmailVerified(consumed.userId);
  return NextResponse.json({ ok: true });
}
