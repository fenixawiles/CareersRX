export type NotificationType = "DECISION_AVAILABLE" | "APPLICATION_RECEIVED" | "HUMAN_REVIEW_REQUIRED";

export type NotificationSummary = {
  id: string;
  applicationId: string | null;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
};

export type RenderedNotificationEmail = {
  subject: string;
  text: string;
};
