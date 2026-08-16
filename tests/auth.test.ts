import { describe, expect, it } from "vitest";
import { query, queryOne, run } from "../lib/db/sql";
import { freshDatabase } from "./harness";
import { consumeAuthToken, issueAuthToken, markEmailVerified, resetPassword } from "../lib/auth/verification";
import { authenticateLocalUser, createLocalSeekerAccount, createLocalSession } from "../lib/local-auth";

async function seedSeeker(email = "casey@example.test") {
  const result = await createLocalSeekerAccount({
    email,
    password: "password123",
    fullName: "Casey Example",
    headline: "RN",
    location: "Tampa, FL",
    summary: "",
    experience: "",
    skills: [],
    credentials: [],
    preferredRoles: [],
    preferredLocations: [],
  });
  if (!result.ok) throw new Error(result.error);
  return result.user;
}

describe("account verification tokens", () => {
  it("issues single-use hashed tokens that verify the email exactly once", async () => {
    await freshDatabase();
    const user = await seedSeeker();
    const token = await issueAuthToken(user.id, user.email, "EMAIL_VERIFICATION");

    // Hashed at rest: the raw token never appears in the tokens table.
    const stored = await queryOne<{ token_hash: string }>("SELECT token_hash FROM tokens WHERE user_id = ?", [user.id]);
    expect(stored?.token_hash).not.toContain(token);

    const consumed = await consumeAuthToken(token, "EMAIL_VERIFICATION");
    expect(consumed).toEqual({ userId: user.id, email: user.email });
    await markEmailVerified(user.id);
    const verified = await queryOne<{ email_verified_at: string | null }>(
      "SELECT email_verified_at FROM users WHERE id = ?",
      [user.id],
    );
    expect(verified?.email_verified_at).not.toBeNull();

    // Single use, and the wrong type never matches.
    expect(await consumeAuthToken(token, "EMAIL_VERIFICATION")).toBeNull();
    const second = await issueAuthToken(user.id, user.email, "PASSWORD_RESET");
    expect(await consumeAuthToken(second, "EMAIL_VERIFICATION")).toBeNull();
  });

  it("rejects expired tokens and invalidates earlier tokens on reissue", async () => {
    await freshDatabase();
    const user = await seedSeeker();
    const first = await issueAuthToken(user.id, user.email, "EMAIL_VERIFICATION");
    const second = await issueAuthToken(user.id, user.email, "EMAIL_VERIFICATION");
    expect(await consumeAuthToken(first, "EMAIL_VERIFICATION")).toBeNull();

    await run("UPDATE tokens SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL");
    expect(await consumeAuthToken(second, "EMAIL_VERIFICATION")).toBeNull();
  });
});

describe("login hardening", () => {
  it("locks the account after repeated failures and clears the counter on success", async () => {
    await freshDatabase();
    const user = await seedSeeker();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(await authenticateLocalUser(user.email, "wrong-password")).toBeNull();
    }
    const locked = await queryOne<{ failed_logins: number; locked_until: string | null }>(
      "SELECT failed_logins, locked_until FROM users WHERE id = ?",
      [user.id],
    );
    expect(Number(locked?.failed_logins)).toBe(10);
    expect(locked?.locked_until).not.toBeNull();
    // Even the correct password is refused while locked.
    expect(await authenticateLocalUser(user.email, "password123")).toBeNull();

    await run("UPDATE users SET locked_until = now() - interval '1 minute' WHERE id = ?", [user.id]);
    expect(await authenticateLocalUser(user.email, "password123")).not.toBeNull();
    const cleared = await queryOne<{ failed_logins: number }>("SELECT failed_logins FROM users WHERE id = ?", [user.id]);
    expect(Number(cleared?.failed_logins)).toBe(0);
  });

  it("password reset replaces the hash and revokes every session", async () => {
    await freshDatabase();
    const user = await seedSeeker();
    await createLocalSession(user.id);
    await createLocalSession(user.id);
    expect((await query("SELECT id FROM sessions WHERE user_id = ?", [user.id])).length).toBe(2);

    await resetPassword(user.id, "new-password-9");
    expect((await query("SELECT id FROM sessions WHERE user_id = ?", [user.id])).length).toBe(0);
    expect(await authenticateLocalUser(user.email, "password123")).toBeNull();
    expect(await authenticateLocalUser(user.email, "new-password-9")).not.toBeNull();
  });
});
