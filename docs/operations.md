# CareersRX operations

## Production configuration

Set `CAREERSRX_ALLOWED_ORIGINS` to a comma-separated allowlist of full origins. The server refuses to load the protected mutation layer in production without it; request `Host` headers are never used as a production fallback.

For email delivery, set `CAREERSRX_APP_URL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`. Decision writes only enqueue durable `notification_outbox` records. A trusted worker invokes `deliverNextNotificationEmail` with a stable worker ID; it leases one pending item, records retry state, and dead-letters after the configured maximum attempts. Never invoke the sender synchronously from an applicant or employer HTTP request.

## Data handling

Applicant explanations, decisions, findings, evidence, notifications, and audit records are retained immutably. Email templates contain an update link only; they never include a reason, evidence, model output, score, or ranking.

Retention is executed only by the internally authenticated sweep endpoint. It records a durable sweep result, excludes every application under legal hold, and pseudonymizes eligible application PII while retaining immutable decision/audit history. Account deletion endpoints record a request for controlled processing rather than deleting in a browser request.

## Monitoring

Applicant insights are derived only from explanations already released to that applicant. The administrative decision export is de-identified, sourced from released explanation bodies, and suppresses cohorts smaller than ten. Neither surface can be used to rank or compare applicants. Review outbox failures/dead-letter counts, migration history, retention sweep records, and append-only audit activity as part of deployment checks.
