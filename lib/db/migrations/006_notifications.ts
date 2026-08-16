import type { Migration } from "@/lib/db/migrate";
import { forbid } from "@/lib/db/migrations/util";

export const notificationsMigration: Migration = {
  version: 6,
  name: "notifications",
  checksum: "sha256:pg-notifications-v1",
  async up(client) {
    await client.exec(`
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        recipient_user_id TEXT NOT NULL REFERENCES users(id),
        application_id TEXT REFERENCES applications(id),
        type TEXT NOT NULL CHECK (type IN ('DECISION_AVAILABLE', 'APPLICATION_RECEIVED', 'HUMAN_REVIEW_REQUIRED')),
        payload_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        read_at TIMESTAMPTZ
      );
      CREATE INDEX notifications_recipient_created_idx
        ON notifications(recipient_user_id, created_at DESC);
      CREATE INDEX notifications_application_idx
        ON notifications(application_id, created_at DESC);

      CREATE TABLE notification_outbox (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL UNIQUE REFERENCES notifications(id),
        channel TEXT NOT NULL CHECK (channel IN ('EMAIL')),
        state TEXT NOT NULL CHECK (state IN ('PENDING', 'CLAIMED', 'SENT', 'FAILED', 'DEAD_LETTERED')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
        next_attempt_at TIMESTAMPTZ NOT NULL,
        claimed_by TEXT,
        claimed_at TIMESTAMPTZ,
        lease_expires_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        provider_message_id TEXT,
        last_error_code TEXT,
        last_error_detail TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX notification_outbox_ready_idx
        ON notification_outbox(state, next_attempt_at);
    `);

    // The message payload is immutable. A recipient may only acknowledge it once.
    await client.exec(forbid({
      name: "notifications_no_mutation",
      table: "notifications",
      operation: "UPDATE",
      when: `NEW.id <> OLD.id
        OR NEW.recipient_user_id <> OLD.recipient_user_id
        OR NEW.application_id IS DISTINCT FROM OLD.application_id
        OR NEW.type <> OLD.type
        OR NEW.payload_json IS DISTINCT FROM OLD.payload_json
        OR NEW.created_at <> OLD.created_at
        OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at)
        OR (OLD.read_at IS NULL AND NEW.read_at IS NULL)`,
      message: "notification payload is immutable",
    }));
    await client.exec(forbid({
      name: "notifications_no_delete",
      table: "notifications",
      operation: "DELETE",
      message: "notifications are retained and cannot be deleted individually",
    }));
    await client.exec(forbid({
      name: "notification_outbox_no_identity_mutation",
      table: "notification_outbox",
      operation: "UPDATE",
      when: `NEW.id <> OLD.id OR NEW.notification_id <> OLD.notification_id OR NEW.channel <> OLD.channel
        OR NEW.max_attempts <> OLD.max_attempts OR NEW.created_at <> OLD.created_at`,
      message: "notification outbox identity is immutable",
    }));
    await client.exec(forbid({
      name: "notification_outbox_no_delete",
      table: "notification_outbox",
      operation: "DELETE",
      message: "notification outbox records are retained",
    }));
  },
};
