import type { SqliteConnection } from "@/lib/db/connection";

export const notificationsMigration = {
  version: 7,
  name: "notifications",
  checksum: "sha256:c89bb69b4db6bbe2952be93fddc127b592fc3547110b5bc6bdfcdd8377294d3e",
  up(connection: SqliteConnection) {
    connection.exec(`
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        recipient_user_id TEXT NOT NULL REFERENCES local_users(id),
        application_id TEXT REFERENCES local_applications(id),
        type TEXT NOT NULL CHECK (type IN ('DECISION_AVAILABLE', 'APPLICATION_RECEIVED', 'HUMAN_REVIEW_REQUIRED')),
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read_at TEXT
      );
      CREATE INDEX notifications_recipient_created_idx
        ON notifications(recipient_user_id, created_at DESC);
      CREATE INDEX notifications_application_idx
        ON notifications(application_id, created_at DESC);

      -- The message payload is immutable. A recipient may only acknowledge it once.
      CREATE TRIGGER notifications_no_mutation
      BEFORE UPDATE ON notifications
      WHEN NEW.id <> OLD.id
        OR NEW.recipient_user_id <> OLD.recipient_user_id
        OR NEW.application_id IS NOT OLD.application_id
        OR NEW.type <> OLD.type
        OR NEW.payload_json <> OLD.payload_json
        OR NEW.created_at <> OLD.created_at
        OR (OLD.read_at IS NOT NULL AND NEW.read_at <> OLD.read_at)
        OR (OLD.read_at IS NULL AND NEW.read_at IS NULL)
      BEGIN SELECT RAISE(ABORT, 'notification payload is immutable'); END;
      CREATE TRIGGER notifications_no_delete
      BEFORE DELETE ON notifications
      BEGIN SELECT RAISE(ABORT, 'notifications are retained and cannot be deleted individually'); END;

      -- Delivery is decoupled from the decision write. A worker can retry the outbox without
      -- creating a second applicant notification or re-running the employer decision transaction.
      CREATE TABLE notification_outbox (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL UNIQUE REFERENCES notifications(id),
        channel TEXT NOT NULL CHECK (channel IN ('EMAIL')),
        state TEXT NOT NULL CHECK (state IN ('PENDING', 'CLAIMED', 'SENT', 'FAILED', 'DEAD_LETTERED')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
        next_attempt_at TEXT NOT NULL,
        claimed_by TEXT,
        claimed_at TEXT,
        lease_expires_at TEXT,
        sent_at TEXT,
        provider_message_id TEXT,
        last_error_code TEXT,
        last_error_detail TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX notification_outbox_ready_idx
        ON notification_outbox(state, next_attempt_at);
      CREATE TRIGGER notification_outbox_no_identity_mutation
      BEFORE UPDATE ON notification_outbox
      WHEN NEW.id <> OLD.id OR NEW.notification_id <> OLD.notification_id OR NEW.channel <> OLD.channel
        OR NEW.max_attempts <> OLD.max_attempts OR NEW.created_at <> OLD.created_at
      BEGIN SELECT RAISE(ABORT, 'notification outbox identity is immutable'); END;
      CREATE TRIGGER notification_outbox_no_delete
      BEFORE DELETE ON notification_outbox
      BEGIN SELECT RAISE(ABORT, 'notification outbox records are retained'); END;
    `);
  },
};
