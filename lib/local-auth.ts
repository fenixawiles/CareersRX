import "server-only";

import { execFileSync } from "node:child_process";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { createSandboxProfile } from "@/lib/sqlite-sandbox";
import type { SandboxSignupInput } from "@/lib/sandbox-types";

export const LOCAL_SESSION_COOKIE = "careeros_local_session";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "careersrx-live-resume-sandbox.sqlite");
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

export type LocalUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: "SEEKER";
  createdAt: string;
};

export type LocalSignupInput = SandboxSignupInput & {
  password: string;
  firstName?: string;
  lastName?: string;
};

function sqlString(value: string | null) {
  if (value === null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function runSql(sql: string) {
  mkdirSync(dbDir, { recursive: true });
  execFileSync("sqlite3", [dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function querySql<T>(sql: string): T[] {
  mkdirSync(dbDir, { recursive: true });
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
  return output ? (JSON.parse(output) as T[]) : [];
}

function initializeLocalAuth() {
  runSql(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);
}

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
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: String(row.full_name ?? ""),
    role: "SEEKER",
    createdAt: String(row.created_at ?? ""),
  };
}

function getUserByEmail(email: string) {
  initializeLocalAuth();
  const [row] = querySql<Record<string, unknown>>(
    `SELECT * FROM local_users WHERE email = ${sqlString(normalizeEmail(email))}`,
  );
  return row ?? null;
}

function getUserById(userId: string) {
  initializeLocalAuth();
  const [row] = querySql<Record<string, unknown>>(
    `SELECT * FROM local_users WHERE id = ${sqlString(userId)}`,
  );
  return row ? mapUser(row) : null;
}

export function sandboxIdForUser(userId: string) {
  return `user:${userId}`;
}

export function createLocalSession(userId: string) {
  initializeLocalAuth();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const timestamp = now();
  runSql(
    `INSERT INTO local_sessions (id, token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (${[
      sqlString(randomBytes(16).toString("hex")),
      sqlString(hashToken(token)),
      sqlString(userId),
      sqlString(expiresAt),
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})`,
  );
  return { token, expiresAt };
}

export function createLocalSeekerAccount(input: LocalSignupInput) {
  initializeLocalAuth();
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false as const, error: "Email is required" };
  if (input.password.trim().length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters" };
  }
  if (getUserByEmail(email)) return { ok: false as const, error: "An account already exists for that email" };

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
    createdAt: now(),
  };
  const timestamp = now();
  runSql(
    `INSERT INTO local_users (id, email, password_hash, first_name, last_name, full_name, role, created_at, updated_at) VALUES (${[
      sqlString(user.id),
      sqlString(user.email),
      sqlString(hashPassword(input.password)),
      sqlString(user.firstName),
      sqlString(user.lastName),
      sqlString(user.fullName),
      sqlString(user.role),
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})`,
  );

  createSandboxProfile(
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
    sandboxIdForUser(user.id),
  );

  return { ok: true as const, user };
}

export function authenticateLocalUser(email: string, password: string) {
  const row = getUserByEmail(email);
  if (!row) return null;
  const passwordHash = String(row.password_hash ?? "");
  if (!verifyPassword(password, passwordHash)) return null;
  return mapUser(row);
}

export async function getCurrentLocalUser() {
  initializeLocalAuth();
  const cookieStore = await cookies();
  const token = cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [session] = querySql<Record<string, unknown>>(
    `SELECT * FROM local_sessions WHERE token_hash = ${sqlString(tokenHash)}`,
  );
  if (!session) return null;

  const expiresAt = new Date(String(session.expires_at ?? ""));
  if (Number.isNaN(expiresAt.valueOf()) || expiresAt.getTime() <= Date.now()) {
    runSql(`DELETE FROM local_sessions WHERE token_hash = ${sqlString(tokenHash)}`);
    return null;
  }

  runSql(
    `UPDATE local_sessions SET last_seen_at = ${sqlString(now())} WHERE token_hash = ${sqlString(tokenHash)}`,
  );
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
  initializeLocalAuth();
  runSql(`DELETE FROM local_sessions WHERE token_hash = ${sqlString(hashToken(token))}`);
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
