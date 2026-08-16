import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/auth/verification";
import { clientKey, rateLimit } from "@/lib/auth/rate-limit";
import { getCurrentLocalUser } from "@/lib/local-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentLocalUser();
  if (!user) return NextResponse.json({ error: "Log in required" }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });
  if (!rateLimit(`verify-resend:${user.id}`, 3, 60 * 60 * 1000).allowed || !rateLimit(`verify-resend-ip:${clientKey(request)}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Too many verification emails requested. Try again later." }, { status: 429 });
  }
  await sendVerificationEmail(user);
  return NextResponse.json({ ok: true });
}
