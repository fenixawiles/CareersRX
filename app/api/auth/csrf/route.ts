import { NextResponse } from "next/server";
import { csrfCookieOptions, csrfToken } from "@/lib/http/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = await csrfToken();
  const response = NextResponse.json({ token });
  response.cookies.set({ name: "careersrx_csrf", value: token, ...csrfCookieOptions });
  return response;
}
