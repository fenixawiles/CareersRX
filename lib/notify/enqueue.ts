import "server-only";

import { randomUUID } from "node:crypto";
import { query, queryOne, run } from "@/lib/db/sql";
import type { NotificationSummary, NotificationType } from "@/lib/notify/types";

/**
 * Inserts a private in-app notification and a durable email outbox record in the caller's current
 * transaction. The payload is identifiers only; it is never returned by list APIs or copied into email.
 */
export async function enqueueNotification(
    input: { recipientUserId: string; applicationId?: string; type: NotificationType; payload: Record<string, unknown>; email?: boolean },
) {
  const notificationId = randomUUID();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO notifications (id, recipient_user_id, application_id, type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [notificationId, input.recipientUserId, input.applicationId ?? null, input.type, JSON.stringify(input.payload), now],
  );
  const outboxId = input.email === false
    ? null
    : randomUUID();
  if (outboxId) {
    await run(
      `INSERT INTO notification_outbox (
        id, notification_id, channel, state, attempts, max_attempts, next_attempt_at, created_at, updated_at
      ) VALUES (?, ?, 'EMAIL', 'PENDING', 0, 3, ?, ?, ?)`,
      [outboxId, notificationId, now, now, now],
    );
  }
  return { notificationId, outboxId };
}

export async function listNotificationsForUser(userId: string, limit = 30): Promise<NotificationSummary[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  return (await query<{
    id: string;
    application_id: string | null;
    type: NotificationType;
    created_at: string;
    read_at: string | null;
  }>(
    `SELECT id, application_id, type, created_at, read_at
     FROM notifications WHERE recipient_user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [userId, safeLimit],
  )).map((row) => ({ id: row.id, applicationId: row.application_id, type: row.type, createdAt: row.created_at, readAt: row.read_at }));
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await queryOne<{ id: string; read_at: string | null }>(
    "SELECT id, read_at FROM notifications WHERE id = ? AND recipient_user_id = ?",
    [notificationId, userId],
  );
  if (!notification) return false;
  if (!notification.read_at) {
    await run("UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_user_id = ?", [new Date().toISOString(), notificationId, userId]);
  }
  return true;
}
