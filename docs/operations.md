# CareersRX operations

## Database

CareersRX runs on PostgreSQL. `DATABASE_URL` is required at runtime; the process refuses to open
the database during `next build` (pages that read data are dynamic). Migrations are code-defined in
`lib/db/migrations/` and run automatically on first query per process under a Postgres advisory
lock, so concurrent boots (deploys, restarts) serialize their migration runs. Migrations are
forward-only; rely on managed-Postgres snapshots for rollback.

Local development: `createdb careersrx` (and `createdb careersrx_test` for Vitest) on a local
PostgreSQL 14+, then set `DATABASE_URL=postgres://<user>@localhost:5432/careersrx`. Tests create an
isolated schema per case on `careersrx_test` (`DATABASE_URL_TEST` overrides the default).

## Railway deployment

- Services: the app plus a PostgreSQL database. No volume is required — nothing writes local files.
- `DATABASE_URL`: the Railway Postgres connection string (use the internal hostname when both
  services share a project).
- Build command: `npm run build`. Start: `npm run start`. Migrations run automatically on the first
  query after boot, serialized across replicas by a Postgres advisory lock.
- Healthcheck path: `/api/health` — 200 once the applied migration head matches the build.

Required production variables: `DATABASE_URL`, `CAREERSRX_APP_URL` (public origin, used for account
email links — production canonical is `https://careersrx.life`), `CAREERSRX_ALLOWED_ORIGINS`
(`https://careersrx.life,https://www.careersrx.life`), `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (or
`RESEND_FROM`; verify `careersrx.life` as a Resend sending domain so account email passes
DKIM/SPF), `CRON_SECRET`. Optional: `OPENAI_API_KEY`/`OPENAI_MODEL` (evaluation completes as
PARTIAL_DETERMINISTIC without them), `PGPOOL_MAX`.

## Production configuration

Set `CAREERSRX_ALLOWED_ORIGINS` to a comma-separated allowlist of full origins. The server refuses to load the protected mutation layer in production without it; request `Host` headers are never used as a production fallback.

For email delivery, set `CAREERSRX_APP_URL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`. Decision writes only enqueue durable `notification_outbox` records. A trusted worker invokes `deliverNextNotificationEmail` with a stable worker ID; it leases one pending item, records retry state, and dead-letters after the configured maximum attempts. Never invoke the sender synchronously from an applicant or employer HTTP request.

## Data handling

Applicant explanations, decisions, findings, evidence, notifications, and audit records are retained immutably. Email templates contain an update link only; they never include a reason, evidence, model output, score, or ranking.

Retention is executed only by the internally authenticated sweep endpoint. It records a durable sweep result, excludes every application under legal hold, and pseudonymizes eligible application PII while retaining immutable decision/audit history. Account deletion endpoints record a request for controlled processing rather than deleting in a browser request.

## Monitoring

Applicant insights are derived only from explanations already released to that applicant. The administrative decision export is de-identified, sourced from released explanation bodies, and suppresses cohorts smaller than ten. Neither surface can be used to rank or compare applicants. Review outbox failures/dead-letter counts, migration history, retention sweep records, and append-only audit activity as part of deployment checks.
