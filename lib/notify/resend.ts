import "server-only";

import { Resend } from "resend";
import { queryOneFile, runFile, transactionFile } from "@/lib/db/sql";
import { renderNotificationEmail } from "@/lib/notify/render";
import type { NotificationType } from "@/lib/notify/types";

type ClaimedEmail = { id: string; notification_id: string; email: string; type: NotificationType };

function now() {
  return new Date().toISOString();
}

function appBaseUrl() {
  const value = process.env.CAREERSRX_APP_URL;
  if (!value) throw new Error("CAREERSRX_APP_URL is required to deliver notification email.");
  return new URL(value).origin;
}

function claimPendingEmail(dbPath: string, workerId: string): ClaimedEmail | null {
  return transactionFile(dbPath, () => {
    const candidate = queryOneFile<ClaimedEmail>(
      dbPath,
      `SELECT outbox.id, outbox.notification_id, user.email, notification.type
       FROM notification_outbox outbox
       JOIN notifications notification ON notification.id = outbox.notification_id
       JOIN local_users user ON user.id = notification.recipient_user_id
       WHERE outbox.channel = 'EMAIL'
         AND (outbox.state = 'PENDING' OR (outbox.state = 'CLAIMED' AND outbox.lease_expires_at < ?))
         AND outbox.next_attempt_at <= ?
       ORDER BY outbox.created_at ASC LIMIT 1`,
      [now(), now()],
    );
    if (!candidate) return null;
    const claimedAt = now();
    const result = runFile(
      dbPath,
      `UPDATE notification_outbox
       SET state = 'CLAIMED', attempts = attempts + 1, claimed_by = ?, claimed_at = ?,
           lease_expires_at = datetime(?, '+5 minutes'), updated_at = ?
       WHERE id = ? AND (state = 'PENDING' OR (state = 'CLAIMED' AND lease_expires_at < ?))`,
      [workerId, claimedAt, claimedAt, claimedAt, candidate.id, claimedAt],
    );
    return result.changes === 1 ? candidate : null;
  });
}

/** Sends at most one leased email. Cron/worker callers invoke this repeatedly; no HTTP handler sends inline. */
export async function deliverNextNotificationEmail(dbPath: string, workerId: string) {
  const claimed = claimPendingEmail(dbPath, workerId);
  if (!claimed) return { delivered: false as const };
  try {
    const rendered = renderNotificationEmail({
      type: claimed.type,
      notificationId: claimed.notification_id,
      applicationPath: `${appBaseUrl()}/dashboard/seeker/applications`,
    });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL are required to deliver notification email.");
    const result = await new Resend(apiKey).emails.send({ from, to: [claimed.email], subject: rendered.subject, text: rendered.text });
    if (result.error) throw new Error(result.error.message);
    runFile(
      dbPath,
      `UPDATE notification_outbox
       SET state = 'SENT', sent_at = ?, provider_message_id = ?, lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND state = 'CLAIMED' AND claimed_by = ?`,
      [now(), result.data?.id ?? null, now(), claimed.id, workerId],
    );
    return { delivered: true as const, outboxId: claimed.id };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1200) : "Unknown delivery error";
    runFile(
      dbPath,
      `UPDATE notification_outbox
       SET state = CASE WHEN attempts >= max_attempts THEN 'DEAD_LETTERED' ELSE 'PENDING' END,
           next_attempt_at = datetime('now', '+5 minutes'), lease_expires_at = NULL,
           last_error_code = 'DELIVERY_FAILED', last_error_detail = ?, updated_at = ?
       WHERE id = ? AND state = 'CLAIMED' AND claimed_by = ?`,
      [message, now(), claimed.id, workerId],
    );
    return { delivered: false as const, outboxId: claimed.id, error: "DELIVERY_FAILED" as const };
  }
}
