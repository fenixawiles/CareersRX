import { describe, expect, it } from "vitest";
import { freshDatabase } from "./harness";
import { query, run } from "../lib/db/sql";
import { enqueueNotification, listNotificationsForUser, markNotificationRead } from "../lib/notify/enqueue";

describe("in-app notifications", () => {
  it("exposes no sensitive payload and allows only a recipient to acknowledge a notification", async () => {
    await freshDatabase();
    await run(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["seeker", "seeker@example.test", "hash", "Seeker", "User", "Seeker User", "SEEKER", 0, "now", "now"],
    );
    const { notificationId: id, outboxId } = await enqueueNotification({
      recipientUserId: "seeker",
      type: "DECISION_AVAILABLE",
      payload: { decisionId: "private-decision-id", applicationId: "private-application-id" },
    });
    expect(await listNotificationsForUser("seeker")).toEqual([
      expect.objectContaining({ id, type: "DECISION_AVAILABLE", applicationId: null, readAt: null }),
    ]);
    expect(outboxId).toBeTruthy();
    expect(await markNotificationRead("other-user", id)).toBe(false);
    expect(await markNotificationRead("seeker", id)).toBe(true);
    expect((await query<{ payload_json: string; read_at: string | null }>("SELECT payload_json, read_at FROM notifications WHERE id = ?", [id]))[0]?.read_at).not.toBeNull();
    expect((await query<{ state: string; notification_id: string }>("SELECT state, notification_id FROM notification_outbox WHERE id = ?", [outboxId!]))[0])
      .toEqual({ state: "PENDING", notification_id: id });
    await expect(async () => await run("UPDATE notifications SET payload_json = ? WHERE id = ?", ["{}", id])).rejects.toThrow("notification payload is immutable");
  });
});
