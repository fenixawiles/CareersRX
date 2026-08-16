import "server-only";

import { createHash, randomBytes } from "node:crypto";
import slugify from "slugify";
import { query, queryOne, run, tx } from "@/lib/db/sql";
import { runDeterministicEvaluationInTransaction } from "@/lib/evaluation/run";
import { getSandboxSnapshot } from "@/lib/resume/store";

export type LocalCompany = {
  id: string;
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  website: string;
  phone: string;
  description: string;
  verificationStatus: "APPROVED";
  createdAt: string;
  updatedAt: string;
};

export type LocalJobStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "CLOSED";

export type LocalJob = {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  category: string;
  facilityType: string | null;
  jobType: string;
  shifts: string[];
  city: string;
  state: string;
  zip: string;
  description: string;
  requirements: string;
  benefits: string;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  payType: string | null;
  showSalary: boolean;
  signOnBonusCents: number | null;
  eeoStatement: string;
  status: LocalJobStatus;
  publishedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    website: string | null;
    verificationStatus: "APPROVED";
  };
};

export type LocalApplication = {
  id: string;
  jobId: string;
  seekerUserId: string;
  seekerName: string;
  seekerEmail: string;
  seekerHeadline: string;
  seekerLocation: string;
  coverLetter: string;
  licenseConfirmed: boolean;
  accommodationNoticeShown?: boolean;
  status: "PENDING" | "REVIEWED" | "WITHDRAWN";
  createdAt: Date;
  profileSnapshot: Record<string, unknown>;
  resumeSnapshot: Record<string, unknown>;
  job: LocalJob;
};

export type LocalJobInput = {
  title?: unknown;
  category?: unknown;
  facilityType?: unknown;
  jobType?: unknown;
  shifts?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  description?: unknown;
  requirements?: unknown;
  benefits?: unknown;
  salaryMin?: unknown;
  salaryMax?: unknown;
  payType?: unknown;
  eeoStatement?: unknown;
};

type Row = Record<string, unknown>;

function now() {
  return new Date().toISOString();
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  return text(value);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
    .join(",")}}`;
}

function applicationSnapshotHash(profile: unknown, resume: unknown) {
  return createHash("sha256").update(`${canonicalize(profile)}\n${canonicalize(resume)}`).digest("hex");
}

function cents(value: unknown) {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,]/g, ""));
  if (!Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw * 100);
}

function slugBase(value: string) {
  return (
    slugify(value, { lower: true, strict: true, trim: true }) ||
    `posting-${randomBytes(4).toString("hex")}`
  );
}

async function uniqueSlug(table: "companies" | "jobs", base: string, excludeId?: string) {
  const root = slugBase(base);
  let candidate = root;
  let suffix = 2;
  while (true) {
    const row = excludeId
      ? await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE slug = ? AND id != ?`, [candidate, excludeId])
      : await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE slug = ?`, [candidate]);
    if (!Number(row?.count ?? 0)) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
}

function mapCompany(row: Row): LocalCompany {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    contactName: String(row.contact_name ?? ""),
    contactEmail: String(row.contact_email ?? ""),
    website: String(row.website ?? ""),
    phone: String(row.phone ?? ""),
    description: String(row.description ?? ""),
    verificationStatus: "APPROVED",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapJob(row: Row): LocalJob {
  return {
    id: String(row.id ?? ""),
    companyId: String(row.company_id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    category: String(row.category ?? ""),
    facilityType: row.facility_type == null ? null : String(row.facility_type),
    jobType: String(row.job_type ?? ""),
    shifts: parseJson<string[]>(row.shifts_json, []),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    zip: String(row.zip ?? ""),
    description: String(row.description ?? ""),
    requirements: String(row.requirements ?? ""),
    benefits: String(row.benefits ?? ""),
    salaryMinCents: row.salary_min_cents == null ? null : Number(row.salary_min_cents),
    salaryMaxCents: row.salary_max_cents == null ? null : Number(row.salary_max_cents),
    payType: row.pay_type == null ? null : String(row.pay_type),
    showSalary: row.show_salary === true,
    signOnBonusCents: null,
    eeoStatement: String(row.eeo_statement ?? ""),
    status: String(row.status ?? "DRAFT") as LocalJobStatus,
    publishedAt: row.published_at ? new Date(String(row.published_at)) : null,
    expiresAt: row.expires_at ? new Date(String(row.expires_at)) : null,
    createdAt: new Date(String(row.created_at ?? now())),
    updatedAt: new Date(String(row.updated_at ?? now())),
    company: {
      id: String(row.company_id ?? ""),
      name: String(row.company_name ?? ""),
      slug: String(row.company_slug ?? ""),
      logoUrl: null,
      website: row.company_website ? String(row.company_website) : null,
      verificationStatus: "APPROVED",
    },
  };
}

function mapApplication(row: Row): LocalApplication {
  return {
    id: String(row.application_id ?? row.id ?? ""),
    jobId: String(row.job_id ?? ""),
    seekerUserId: String(row.seeker_user_id ?? ""),
    seekerName: String(row.seeker_name ?? ""),
    seekerEmail: String(row.seeker_email ?? ""),
    seekerHeadline: String(row.seeker_headline ?? ""),
    seekerLocation: String(row.seeker_location ?? ""),
    coverLetter: String(row.cover_letter ?? ""),
    licenseConfirmed: row.license_confirmed === true,
    status: String(row.application_status ?? row.status ?? "PENDING") as LocalApplication["status"],
    createdAt: new Date(String(row.application_created_at ?? row.created_at ?? now())),
    profileSnapshot: parseJson<Record<string, unknown>>(row.profile_snapshot_json, {}),
    resumeSnapshot: parseJson<Record<string, unknown>>(row.resume_snapshot_json, {}),
    job: mapJob(row),
  };
}

async function jobSelect(whereSql: string, parameters: (string | number)[], order = "j.created_at DESC") {
  const rows = await query<Row>(
    `SELECT
      j.*,
      c.name AS company_name,
      c.slug AS company_slug,
      c.website AS company_website
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE ${whereSql}
    ORDER BY ${order}`,
    parameters,
  );
  return rows.map(mapJob);
}

export async function createLocalCompanyForOwner(input: {
  ownerUserId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
}) {
  const timestamp = now();
  const companyId = randomBytes(16).toString("hex");
  const slug = await uniqueSlug("companies", input.companyName);

  await tx(async () => {
    await run(
      "INSERT INTO companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'APPROVED', ?, ?)",
      [companyId, input.companyName.trim(), slug, input.contactName.trim(), input.contactEmail.trim().toLowerCase(), timestamp, timestamp],
    );
    await run(
      "INSERT INTO company_users (id, company_id, user_id, role, created_at) VALUES (?, ?, ?, 'OWNER', ?)",
      [randomBytes(16).toString("hex"), companyId, input.ownerUserId, timestamp],
    );
  });

  return getCompanyForUser(input.ownerUserId);
}

export async function getCompanyForUser(userId: string) {
  const row = await queryOne<Row>(
    `SELECT c.*
    FROM companies c
    JOIN company_users cu ON cu.company_id = c.id
    WHERE cu.user_id = ? AND cu.revoked_at IS NULL
    LIMIT 1`,
    [userId],
  );
  return row ? mapCompany(row) : null;
}

export async function updateCompanyForUser(userId: string, input: Partial<LocalCompany>) {
  const company = await getCompanyForUser(userId);
  if (!company) return null;
  const name = text(input.name) || company.name;
  const slug = name === company.name ? company.slug : await uniqueSlug("companies", name, company.id);
  await run(
    `UPDATE companies
    SET name = ?, slug = ?, website = ?, phone = ?, description = ?, contact_name = ?, contact_email = ?, updated_at = ?
    WHERE id = ?`,
    [
      name,
      slug,
      optionalText(input.website),
      optionalText(input.phone),
      optionalText(input.description),
      text(input.contactName) || company.contactName,
      text(input.contactEmail).toLowerCase() || company.contactEmail,
      now(),
      company.id,
    ],
  );
  return getCompanyForUser(userId);
}

function normalizeJobInput(input: LocalJobInput) {
  const title = text(input.title);
  const city = text(input.city);
  const state = text(input.state);
  const description = text(input.description);
  if (!title) return { ok: false as const, error: "Job title is required" };
  if (!city || !state) return { ok: false as const, error: "City and state are required" };
  if (!description) return { ok: false as const, error: "Job description is required" };

  const salaryMinCents = cents(input.salaryMin);
  const salaryMaxCents = cents(input.salaryMax);
  return {
    ok: true as const,
    job: {
      title,
      category: text(input.category) || "Administration & Leadership",
      facilityType: text(input.facilityType) || "OTHER",
      jobType: text(input.jobType) || "FULL_TIME",
      shifts: Array.isArray(input.shifts)
        ? input.shifts.filter((shift): shift is string => typeof shift === "string" && shift.trim().length > 0)
        : ["DAY"],
      city,
      state,
      zip: optionalText(input.zip),
      description,
      requirements: optionalText(input.requirements),
      benefits: optionalText(input.benefits),
      salaryMinCents,
      salaryMaxCents,
      payType: text(input.payType) || "HOURLY",
      showSalary: salaryMinCents !== null || salaryMaxCents !== null,
      eeoStatement: optionalText(input.eeoStatement),
    },
  };
}

export async function listJobsForCompany(companyId: string) {
  return jobSelect("j.company_id = ?", [companyId], "j.updated_at DESC");
}

export async function getJobForCompany(jobId: string, companyId: string) {
  return (await jobSelect("j.id = ? AND j.company_id = ?", [jobId, companyId]))[0] ?? null;
}

export async function createJobForCompany(companyId: string, input: LocalJobInput) {
  const parsed = normalizeJobInput(input);
  if (!parsed.ok) return parsed;
  const timestamp = now();
  const jobId = randomBytes(16).toString("hex");
  const slug = await uniqueSlug("jobs", `${parsed.job.title}-${parsed.job.city}-${parsed.job.state}`);
  await tx(async () => {
    await run(
      `INSERT INTO jobs (
        id, company_id, slug, title, category, facility_type, job_type, shifts_json, city, state, zip,
        description, requirements, benefits, salary_min_cents, salary_max_cents, pay_type,
        show_salary, eeo_statement, status, published_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', NULL, NULL, ?, ?)`,
      [
        jobId,
        companyId,
        slug,
        parsed.job.title,
        parsed.job.category,
        parsed.job.facilityType,
        parsed.job.jobType,
        JSON.stringify(parsed.job.shifts),
        parsed.job.city,
        parsed.job.state,
        parsed.job.zip,
        parsed.job.description,
        parsed.job.requirements,
        parsed.job.benefits,
        parsed.job.salaryMinCents,
        parsed.job.salaryMaxCents,
        parsed.job.payType,
        parsed.job.showSalary,
        parsed.job.eeoStatement,
        timestamp,
        timestamp,
      ],
    );
    await run(
      "INSERT INTO job_criteria_sets (id, job_id, version, status, authoring_state, created_at) VALUES (?, ?, 1, 'DRAFT', 'UNSTRUCTURED', ?)",
      [randomBytes(16).toString("hex"), jobId, timestamp],
    );
  });
  return { ok: true as const, job: (await getJobForCompany(jobId, companyId))! };
}

export async function updateJobForCompany(jobId: string, companyId: string, input: LocalJobInput) {
  const existing = await getJobForCompany(jobId, companyId);
  if (!existing) return { ok: false as const, error: "Job not found" };
  const merged = { ...existing, ...input };
  const parsed = normalizeJobInput(merged);
  if (!parsed.ok) return parsed;
  await run(
    `UPDATE jobs
    SET title = ?, category = ?, facility_type = ?, job_type = ?, shifts_json = ?, city = ?, state = ?, zip = ?,
        description = ?, requirements = ?, benefits = ?, salary_min_cents = ?, salary_max_cents = ?, pay_type = ?,
        show_salary = ?, eeo_statement = ?, updated_at = ?
    WHERE id = ? AND company_id = ?`,
    [
      parsed.job.title,
      parsed.job.category,
      parsed.job.facilityType,
      parsed.job.jobType,
      JSON.stringify(parsed.job.shifts),
      parsed.job.city,
      parsed.job.state,
      parsed.job.zip,
      parsed.job.description,
      parsed.job.requirements,
      parsed.job.benefits,
      parsed.job.salaryMinCents,
      parsed.job.salaryMaxCents,
      parsed.job.payType,
      parsed.job.showSalary,
      parsed.job.eeoStatement,
      now(),
      jobId,
      companyId,
    ],
  );
  return { ok: true as const, job: (await getJobForCompany(jobId, companyId))! };
}

export async function setJobStatusForCompany(jobId: string, companyId: string, status: LocalJobStatus) {
  const job = await getJobForCompany(jobId, companyId);
  if (!job) return null;
  const timestamp = now();
  const publishedAt =
    status === "ACTIVE" ? job.publishedAt?.toISOString() ?? timestamp : job.publishedAt?.toISOString() ?? null;
  await tx(async () => {
    if (status === "ACTIVE") {
      const draft = await queryOne<Row>(
        "SELECT id FROM job_criteria_sets WHERE job_id = ? AND status = 'DRAFT' LIMIT 1",
        [jobId],
      );
      if (draft?.id) {
        await run("UPDATE job_criteria_sets SET status = 'PUBLISHED', published_at = ? WHERE id = ?", [
          timestamp,
          String(draft.id),
        ]);
      }
    }
    await run("UPDATE jobs SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND company_id = ?", [
      status,
      publishedAt,
      timestamp,
      jobId,
      companyId,
    ]);
  });
  return getJobForCompany(jobId, companyId);
}

export async function listPublicJobs(filters: {
  q?: string;
  category?: string;
  state?: string;
  jobType?: string;
  page?: number;
  pageSize?: number;
}) {
  const clauses = ["j.status = 'ACTIVE'"];
  const parameters: (string | number)[] = [];
  if (filters.state) {
    clauses.push("j.state = ?");
    parameters.push(filters.state);
  }
  if (filters.category) {
    clauses.push("j.category = ?");
    parameters.push(filters.category);
  }
  if (filters.jobType) {
    clauses.push("j.job_type = ?");
    parameters.push(filters.jobType);
  }
  if (filters.q) {
    const q = `%${filters.q.replaceAll("%", "").replaceAll("_", "")}%`;
    // SQLite LIKE was case-insensitive; ILIKE preserves that behavior on Postgres.
    clauses.push("(j.title ILIKE ? OR j.description ILIKE ? OR j.city ILIKE ? OR c.name ILIKE ?)");
    parameters.push(q, q, q, q);
  }
  const where = clauses.join(" AND ");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 12;
  const countRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ${where}`,
    parameters,
  );
  const jobs = (
    await query<Row>(
      `SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.website AS company_website
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE ${where}
      ORDER BY j.published_at DESC NULLS LAST, j.created_at DESC
      LIMIT ? OFFSET ?`,
      [...parameters, pageSize, (page - 1) * pageSize],
    )
  ).map(mapJob);
  return { jobs, total: Number(countRow?.count ?? 0) };
}

export async function getPublicJobStats() {
  const jobRow = await queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE status = 'ACTIVE'");
  const companyRow = await queryOne<{ count: number }>(
    "SELECT COUNT(DISTINCT company_id) AS count FROM jobs WHERE status = 'ACTIVE'",
  );
  return {
    jobCount: Number(jobRow?.count ?? 0),
    companyCount: Number(companyRow?.count ?? 0),
  };
}

export async function getPublicJobBySlug(slug: string) {
  return (await jobSelect("j.slug = ? AND j.status = 'ACTIVE'", [slug]))[0] ?? null;
}

export async function listRelatedPublicJobs(job: LocalJob, take = 3) {
  const rows = await query<Row>(
    `SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.website AS company_website
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'ACTIVE' AND j.category = ? AND j.id != ?
    ORDER BY j.published_at DESC NULLS LAST, j.created_at DESC
    LIMIT ?`,
    [job.category, job.id, take],
  );
  return rows.map(mapJob);
}

export async function createApplication(input: {
  jobId: string;
  seekerUserId: string;
  seekerEmail: string;
  sandboxId: string;
  coverLetter?: string;
  licenseConfirmed: boolean;
  accommodationNoticeShown?: boolean;
}) {
  const snapshot = await getSandboxSnapshot(input.sandboxId);
  const timestamp = now();
  const id = randomBytes(16).toString("hex");
  const profileJson = JSON.stringify(snapshot.profile);
  const resumeJson = JSON.stringify(snapshot.resume);
  let failure: string | null = null;

  await tx(async () => {
    const job = (await jobSelect("j.id = ? AND j.status = 'ACTIVE'", [input.jobId]))[0];
    if (!job) {
      failure = "This job is not accepting applications";
      return;
    }
    const existing = await queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM applications WHERE job_id = ? AND seeker_user_id = ?",
      [job.id, input.seekerUserId],
    );
    if (Number(existing?.count ?? 0)) {
      failure = "You already applied to this job";
      return;
    }
    const criteriaSet = await queryOne<Row>(
      "SELECT id, authoring_state FROM job_criteria_sets WHERE job_id = ? AND status = 'PUBLISHED' LIMIT 1",
      [job.id],
    );
    if (!criteriaSet?.id) {
      failure = "This job is not ready to accept applications";
      return;
    }

    const evaluationState = criteriaSet.authoring_state === "UNSTRUCTURED" ? "NOT_APPLICABLE" : "NOT_STARTED";
    await run(
      `INSERT INTO applications (
        id, job_id, seeker_user_id, seeker_name, seeker_email, seeker_headline, seeker_location,
        cover_letter, license_confirmed, profile_snapshot_json, resume_snapshot_json, criteria_set_id,
        resume_revision_id, snapshot_hash, submitted_at, evaluation_state, disposition_state,
        accommodation_state, accommodation_notice_shown_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'SUBMITTED', 'NONE', ?, 'PENDING', ?, ?)`,
      [
        id,
        job.id,
        input.seekerUserId,
        snapshot.profile.fullName || input.seekerEmail,
        snapshot.profile.email || input.seekerEmail,
        snapshot.profile.headline,
        snapshot.profile.location,
        optionalText(input.coverLetter),
        input.licenseConfirmed,
        profileJson,
        resumeJson,
        String(criteriaSet.id),
        applicationSnapshotHash(snapshot.profile, snapshot.resume),
        timestamp,
        evaluationState,
        input.accommodationNoticeShown ? timestamp : null,
        timestamp,
        timestamp,
      ],
    );
    await run(
      `INSERT INTO application_transitions (id, application_id, from_state, to_state, actor_kind, actor_user_id, rule_criterion_id, rationale, created_at)
       VALUES (?, ?, NULL, 'SUBMITTED', 'SYSTEM', NULL, NULL, 'Application submitted', ?)`,
      [randomBytes(16).toString("hex"), id, timestamp],
    );
    await run(
      `INSERT INTO audit_events (id, event_type, actor_kind, actor_user_id, entity_type, entity_id, company_id, metadata_json, created_at)
       VALUES (?, 'APPLICATION_SUBMITTED', 'SYSTEM', NULL, 'APPLICATION', ?, ?, ?, ?)`,
      [
        randomBytes(16).toString("hex"),
        id,
        job.companyId,
        JSON.stringify({
          criteriaSetId: String(criteriaSet.id),
          snapshotHash: applicationSnapshotHash(snapshot.profile, snapshot.resume),
        }),
        timestamp,
      ],
    );
    if (evaluationState === "NOT_STARTED") await runDeterministicEvaluationInTransaction(id);
  });
  if (failure) return { ok: false as const, error: failure };
  return { ok: true as const, application: (await getApplication(id))! };
}

// Column order matters: j.* intentionally shadows a.'s id/status/created_at (mapJob reads them),
// while the application's own values survive through the leading aliases — same as the SQLite
// original, and node-pg resolves duplicate field names the same way (last one wins).
const APPLICATION_SELECT = `
  SELECT
    a.id AS application_id,
    a.status AS application_status,
    a.created_at AS application_created_at,
    a.*,
    j.*,
    c.name AS company_name,
    c.slug AS company_slug,
    c.website AS company_website
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN companies c ON c.id = j.company_id`;

export async function getApplication(id: string) {
  const row = await queryOne<Row>(`${APPLICATION_SELECT} WHERE a.id = ? LIMIT 1`, [id]);
  return row ? mapApplication(row) : null;
}

export async function listApplicationsForSeeker(userId: string) {
  const rows = await query<Row>(`${APPLICATION_SELECT} WHERE a.seeker_user_id = ? ORDER BY a.created_at DESC`, [userId]);
  return rows.map(mapApplication);
}

export async function listApplicationsForCompany(companyId: string, jobId?: string) {
  const rows = jobId
    ? await query<Row>(`${APPLICATION_SELECT} WHERE j.company_id = ? AND j.id = ? ORDER BY a.created_at DESC`, [companyId, jobId])
    : await query<Row>(`${APPLICATION_SELECT} WHERE j.company_id = ? ORDER BY a.created_at DESC`, [companyId]);
  return rows.map(mapApplication);
}

export async function listSavedJobsForSeeker(userId: string) {
  const rows = await query<Row>(
    `SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.website AS company_website
    FROM saved_jobs s
    JOIN jobs j ON j.id = s.job_id
    JOIN companies c ON c.id = j.company_id
    WHERE s.seeker_user_id = ? AND j.status = 'ACTIVE'
    ORDER BY s.created_at DESC`,
    [userId],
  );
  return rows.map(mapJob);
}

export async function isJobSaved(userId: string, jobId: string) {
  const row = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM saved_jobs WHERE seeker_user_id = ? AND job_id = ?",
    [userId, jobId],
  );
  return Number(row?.count ?? 0) > 0;
}

export async function saveJobForSeeker(userId: string, jobId: string) {
  await run(
    "INSERT INTO saved_jobs (id, job_id, seeker_user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (job_id, seeker_user_id) DO NOTHING",
    [randomBytes(16).toString("hex"), jobId, userId, now()],
  );
  return { saved: true };
}

export async function removeSavedJobForSeeker(userId: string, jobId: string) {
  await run("DELETE FROM saved_jobs WHERE seeker_user_id = ? AND job_id = ?", [userId, jobId]);
  return { saved: false };
}
