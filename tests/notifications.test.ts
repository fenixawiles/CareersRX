import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { queryFile, runFile } from "../lib/db/sql";
import { enqueueNotification, listNotificationsForUser, markNotificationRead } from "../lib/notify/enqueue";

function temporaryDatabasePath() {
  return join(mkdtempSync(join(tmpdir(), "careersrx-notifications-test-")), "test.sqlite");
}

describe("in-app notifications", () => {
  it("exposes no sensitive payload and allows only a recipient to acknowledge a notification", () => {
    const dbPath = temporaryDatabasePath();
    runFile(
      dbPath,
      `INSERT INTO local_users (id, email, password_hash, first_name, last_name, full_name, role, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["seeker", "seeker@example.test", "hash", "Seeker", "User", "Seeker User", "SEEKER", 0, "now", "now"],
    );
    const { notificationId: id, outboxId } = enqueueNotification(dbPath, {
      recipientUserId: "seeker",
      type: "DECISION_AVAILABLE",
      payload: { decisionId: "private-decision-id", applicationId: "private-application-id" },
    });
    expect(listNotificationsForUser(dbPath, "seeker")).toEqual([
      expect.objectContaining({ id, type: "DECISION_AVAILABLE", applicationId: null, readAt: null }),
    ]);
    expect(outboxId).toBeTruthy();
    expect(markNotificationRead(dbPath, "other-user", id)).toBe(false);
    expect(markNotificationRead(dbPath, "seeker", id)).toBe(true);
    expect(queryFile<{ payload_json: string; read_at: string | null }>(dbPath, "SELECT payload_json, read_at FROM notifications WHERE id = ?", [id])[0]?.read_at).not.toBeNull();
    expect(queryFile<{ state: string; notification_id: string }>(dbPath, "SELECT state, notification_id FROM notification_outbox WHERE id = ?", [outboxId!])[0])
      .toEqual({ state: "PENDING", notification_id: id });
    expect(() => runFile(dbPath, "UPDATE notifications SET payload_json = ? WHERE id = ?", ["{}", id])).toThrow("notification payload is immutable");
  });
});
