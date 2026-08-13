import "server-only";

import type { RenderedNotificationEmail, NotificationType } from "@/lib/notify/types";

/** Fixed templates prevent private decision metadata and model/evidence content from reaching email. */
export function renderNotificationEmail(input: { type: NotificationType; notificationId: string; applicationPath: string }): RenderedNotificationEmail {
  const destination = `${input.applicationPath}${input.applicationPath.includes("?") ? "&" : "?"}notification=${encodeURIComponent(input.notificationId)}`;
  switch (input.type) {
    case "DECISION_AVAILABLE":
      return {
        subject: "An update is available for your CareersRX application",
        text: `There is an update available for one of your applications. Sign in to CareersRX to view it: ${destination}`,
      };
    case "APPLICATION_RECEIVED":
      return {
        subject: "Your CareersRX application was received",
        text: `Your application was received. Sign in to CareersRX for its current status: ${destination}`,
      };
    case "HUMAN_REVIEW_REQUIRED":
      return {
        subject: "A CareersRX application needs review",
        text: `A job-related application review is ready. Sign in to CareersRX to continue: ${destination}`,
      };
  }
}
