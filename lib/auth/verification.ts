import "server-only";

import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { Resend } from "resend";
import { query, queryOne, run, tx } from "@/lib/db/sql";

export type AuthTokenType = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

function now() {
  return new Date().toISOString();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl() {
  const value = process.env.CAREERSRX_APP_URL;
  if (!value) throw new Error("CAREERSRX_APP_URL is required to build account email links.");
  return new URL(value).origin;
}

/** Issues a single-use token, invalidating any earlier unused tokens of the same type. */
export async function issueAuthToken(userId: string, email: string, type: AuthTokenType) {
  const token = randomBytes(32).toString("base64url");
  const timestamp = now();
  await tx(async () => {
    await run("UPDATE tokens SET used_at = ? WHERE user_id = ? AND type = ? AND used_at IS NULL", [
      timestamp,
      userId,
      type,
    ]);
    await run(
      "INSERT INTO tokens (id, user_id, email, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        randomUUID(),
        userId,
        email,
        type,
        hashToken(token),
        new Date(Date.now() + TOKEN_TTL_MS[type]).toISOString(),
        timestamp,
      ],
    );
  });
  return token;
}

/** Marks a token used and returns its owner; null when unknown, expired, or already used. */
export async function consumeAuthToken(rawToken: string, type: AuthTokenType) {
  if (!rawToken || rawToken.length > 200) return null;
  return tx(async () => {
    const row = await queryOne<{ id: string; user_id: string; email: string }>(
      "SELECT id, user_id, email FROM tokens WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > now()",
      [hashToken(rawToken), type],
    );
    if (!row) return null;
    const updated = await run("UPDATE tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", [now(), row.id]);
    if (updated.changes !== 1) return null;
    return { userId: row.user_id, email: row.email };
  });
}

async function sendAccountEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM;
  if (!apiKey || !from) {
    // Local development without Resend configured: surface the link in the server log instead of
    // failing signup. Production deploys set both variables.
    console.warn("[careersrx/email] RESEND not configured; account email suppressed", { subject });
    console.warn(text);
    return { sent: false as const };
  }
  const result = await new Resend(apiKey).emails.send({ from, to: [to], subject, text });
  if (result.error) throw new Error(result.error.message);
  return { sent: true as const, providerMessageId: result.data?.id ?? null };
}

/**
 * Sends the verification email. Metadata-only content: a link and the site name, never profile,
 * résumé, or application data. Failures are logged, not fatal — the user can request a resend.
 */
export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await issueAuthToken(user.id, user.email, "EMAIL_VERIFICATION");
  const link = `${appBaseUrl()}/api/auth/verify?token=${token}`;
  try {
    return await sendAccountEmail(
      user.email,
      "Verify your CareersRX email",
      `Welcome to CareersRX.\n\nConfirm your email address to activate applying and posting:\n\n${link}\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.`,
    );
  } catch (error) {
    console.error("[careersrx/email] verification send failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { sent: false as const };
  }
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const token = await issueAuthToken(user.id, user.email, "PASSWORD_RESET");
  const link = `${appBaseUrl()}/reset-password?token=${token}`;
  try {
    return await sendAccountEmail(
      user.email,
      "Reset your CareersRX password",
      `A password reset was requested for your CareersRX account.\n\nChoose a new password here:\n\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email — your password is unchanged.`,
    );
  } catch (error) {
    console.error("[careersrx/email] password reset send failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { sent: false as const };
  }
}

export async function markEmailVerified(userId: string) {
  const timestamp = now();
  await run("UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND email_verified_at IS NULL", [
    timestamp,
    timestamp,
    userId,
  ]);
}

/** Sets a new password and revokes every active session for the account. */
export async function resetPassword(userId: string, password: string) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  await tx(async () => {
    await run("UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?", [
      passwordHash,
      now(),
      userId,
    ]);
    await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  });
}

export async function findUserByEmailForReset(email: string) {
  const rows = await query<{ id: string; email: string }>("SELECT id, email FROM users WHERE email = ?", [
    email.trim().toLowerCase(),
  ]);
  return rows[0] ?? null;
}
