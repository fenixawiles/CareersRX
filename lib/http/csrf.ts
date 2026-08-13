import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const CSRF_COOKIE = "careersrx_csrf";
const CSRF_HEADER = "x-csrf-token";

export class CsrfError extends Error {
  constructor() {
    super("A valid same-origin CSRF token is required.");
    this.name = "CsrfError";
  }
}

export class CsrfConfigurationError extends Error {
  constructor() {
    super("CAREERSRX_ALLOWED_ORIGINS must list one or more allowed origins in production.");
    this.name = "CsrfConfigurationError";
  }
}

function tokenMatches(expected: string, received: string) {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

/** Returns the non-secret double-submit token used by browser clients for state-changing API calls. */
export async function csrfToken() {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? randomBytes(32).toString("base64url");
}

export function parseAllowedOrigins(value: string | undefined) {
  if (!value?.trim()) return [];
  let origins: string[];
  try {
    origins = value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin).origin);
  } catch {
    throw new CsrfConfigurationError();
  }
  if (origins.length === 0) throw new CsrfConfigurationError();
  return [...new Set(origins)];
}

function allowedOrigins(request: Request) {
  const configured = parseAllowedOrigins(process.env.CAREERSRX_ALLOWED_ORIGINS);
  if (configured.length > 0) return configured;
  if (process.env.NODE_ENV === "production") throw new CsrfConfigurationError();
  // Local development alone may use the request origin; production must always use explicit config.
  return [new URL(request.url).origin];
}

export async function assertCsrf(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(request).includes(origin)) throw new CsrfError();
  const store = await cookies();
  const expected = store.get(CSRF_COOKIE)?.value;
  const received = request.headers.get(CSRF_HEADER);
  if (!expected || !received || !tokenMatches(expected, received)) throw new CsrfError();
}

export const csrfCookieOptions = {
  path: "/",
  httpOnly: false,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 8,
};

// Next loads route modules during `next start`; fail immediately rather than accepting a production
// mutation request under host-derived origin validation. Builds intentionally do not require runtime config.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  parseAllowedOrigins(process.env.CAREERSRX_ALLOWED_ORIGINS);
  if (!process.env.CAREERSRX_ALLOWED_ORIGINS?.trim()) throw new CsrfConfigurationError();
}
