import "server-only";

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createLocalCompanyForOwner } from "@/lib/local-platform";
import { query, queryOne, run, tx } from "@/lib/db/sql";
import { createResumeWorkspace } from "@/lib/resume/store";
import type { SandboxSignupInput } from "@/lib/sandbox-types";

export const LOCAL_SESSION_COOKIE = "careeros_local_session";
export type LocalUserRole = "SEEKER" | "EMPLOYER";

const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

export type LocalUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: LocalUserRole;
  isAdmin: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type LocalSignupInput = SandboxSignupInput & {
  password: string;
  firstName?: string;
  lastName?: string;
};

export type LocalEmployerSignupInput = {
  companyName: string;
  contactName: string;
  email: string;
  password: string;
};

function now() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function mapUser(row: Record<string, unknown>): LocalUser {
  const role = row.role === "EMPLOYER" ? "EMPLOYER" : "SEEKER";
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: String(row.full_name ?? ""),
    role,
    isAdmin: row.is_admin === true,
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

async function getUserRowByEmail(email: string) {
  return queryOne<Record<string, unknown>>("SELECT * FROM users WHERE email = ?", [normalizeEmail(email)]);
}

async function getUserById(userId: string) {
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM users WHERE id = ?", [userId]);
  return row ? mapUser(row) : null;
}

/** Résumé workspaces are keyed directly by user id on Postgres. Kept for call-site stability. */
export function sandboxIdForUser(userId: string) {
  return userId;
}

export function dashboardPathForUser(user: LocalUser) {
  return user.role === "EMPLOYER" ? "/dashboard/employer" : "/dashboard/seeker/profile";
}

export async function createLocalSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const timestamp = now();
  await run(
    "INSERT INTO sessions (id, token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    [randomBytes(16).toString("hex"), hashToken(token), userId, expiresAt, timestamp, timestamp],
  );
  return { token, expiresAt };
}

export async function createLocalSeekerAccount(input: LocalSignupInput) {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false as const, error: "Email is required" };
  if (input.password.trim().length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters" };
  }
  if (await getUserRowByEmail(email)) {
    return { ok: false as const, error: "An account already exists for that email" };
  }

  const fullName = input.fullName.trim();
  const [firstFallback = "", ...lastParts] = fullName.split(" ").filter(Boolean);
  const firstName = (input.firstName?.trim() || firstFallback || fullName).trim();
  const lastName = (input.lastName?.trim() || lastParts.join(" ")).trim();
  const user: LocalUser = {
    id: randomBytes(16).toString("hex"),
    email,
    firstName,
    lastName,
    fullName,
    role: "SEEKER",
    isAdmin: false,
    emailVerifiedAt: null,
    createdAt: now(),
  };

  await tx(async () => {
    const timestamp = now();
    await run(
      "INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [user.id, user.email, hashPassword(input.password), user.firstName, user.lastName, user.fullName, user.role, timestamp, timestamp],
    );
    await createResumeWorkspace(
      {
        email,
        fullName,
        headline: input.headline,
        location: input.location,
        summary: input.summary,
        experience: input.experience,
        skills: input.skills,
        credentials: input.credentials,
        preferredRoles: input.preferredRoles,
        preferredLocations: input.preferredLocations,
      },
      user.id,
    );
  });

  return { ok: true as const, user };
}

export async function createLocalEmployerAccount(input: LocalEmployerSignupInput) {
  const email = normalizeEmail(input.email);
  const companyName = input.companyName.trim();
  const contactName = input.contactName.trim();
  if (!email) return { ok: false as const, error: "Email is required" };
  if (!companyName) return { ok: false as const, error: "Company name is required" };
  if (!contactName) return { ok: false as const, error: "Contact name is required" };
  if (input.password.trim().length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters" };
  }
  if (await getUserRowByEmail(email)) {
    return { ok: false as const, error: "An account already exists for that email" };
  }

  const [firstFallback = contactName, ...lastParts] = contactName.split(" ").filter(Boolean);
  const user: LocalUser = {
    id: randomBytes(16).toString("hex"),
    email,
    firstName: firstFallback,
    lastName: lastParts.join(" "),
    fullName: contactName,
    role: "EMPLOYER",
    isAdmin: false,
    emailVerifiedAt: null,
    createdAt: now(),
  };

  const company = await tx(async () => {
    const timestamp = now();
    await run(
      "INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [user.id, user.email, hashPassword(input.password), user.firstName, user.lastName, user.fullName, user.role, timestamp, timestamp],
    );
    return createLocalCompanyForOwner({
      ownerUserId: user.id,
      companyName,
      contactName,
      contactEmail: email,
    });
  });

  return { ok: true as const, user, company };
}

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function authenticateLocalUser(email: string, password: string) {
  const row = await getUserRowByEmail(email);
  if (!row) return null;

  const lockedUntil = row.locked_until ? new Date(String(row.locked_until)).getTime() : 0;
  if (lockedUntil > Date.now()) return null;

  const passwordHash = String(row.password_hash ?? "");
  if (!verifyPassword(password, passwordHash)) {
    const failures = Number(row.failed_logins ?? 0) + 1;
    await run(
      "UPDATE users SET failed_logins = ?, locked_until = ?, updated_at = ? WHERE id = ?",
      [
        failures,
        failures >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null,
        now(),
        String(row.id),
      ],
    );
    return null;
  }

  if (Number(row.failed_logins ?? 0) > 0 || row.locked_until) {
    await run("UPDATE users SET failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?", [
      now(),
      String(row.id),
    ]);
  }
  return mapUser(row);
}

/**
 * Performs the single permitted bootstrap of an administrator. This intentionally has no HTTP
 * caller: an operator must first register normally, then run scripts/bootstrap-admin.ts with the
 * registered email in ADMIN_SEED_EMAIL.
 */
export async function bootstrapLocalAdmin(email: string) {
  const existingAdmin = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users WHERE is_admin = TRUE",
  );
  if (Number(existingAdmin?.count ?? 0) > 0) {
    return { ok: false as const, error: "An administrator already exists" };
  }

  const user = await getUserRowByEmail(email);
  if (!user) return { ok: false as const, error: "Register this user before bootstrapping an administrator" };

  const timestamp = now();
  const id = randomBytes(16).toString("hex");
  await tx(async () => {
    await run("UPDATE users SET is_admin = TRUE, updated_at = ? WHERE id = ?", [timestamp, String(user.id)]);
    await run(
      `INSERT INTO audit_events (
        id, event_type, actor_kind, actor_user_id, entity_type, entity_id, company_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, "ADMIN_BOOTSTRAPPED", "SYSTEM", null, "USER", String(user.id), null, JSON.stringify({ email: normalizeEmail(email) }), timestamp],
    );
  });

  return { ok: true as const, email: String(user.email) };
}

export async function getCurrentLocalUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await queryOne<Record<string, unknown>>(
    "SELECT * FROM sessions WHERE token_hash = ?",
    [tokenHash],
  );
  if (!session) return null;

  const expiresAt = new Date(String(session.expires_at ?? ""));
  if (Number.isNaN(expiresAt.valueOf()) || expiresAt.getTime() <= Date.now()) {
    await run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
    return null;
  }

  // Throttle the last-seen write to once per minute rather than on every authenticated render.
  const lastSeenAt = new Date(String(session.last_seen_at ?? "")).getTime();
  if (!Number.isFinite(lastSeenAt) || Date.now() - lastSeenAt > 60_000) {
    await run("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", [now(), tokenHash]);
  }
  return getUserById(String(session.user_id ?? ""));
}

export async function getCurrentLocalUserSandboxId() {
  const user = await getCurrentLocalUser();
  return user ? sandboxIdForUser(user.id) : null;
}

export async function deleteCurrentLocalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  if (!token) return;
  await run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

export function sessionCookieOptions(expiresAt: string) {
  return {
    name: LOCAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
  };
}
