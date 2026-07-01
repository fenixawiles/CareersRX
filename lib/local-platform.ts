import "server-only";

import { randomBytes } from "node:crypto";
import path from "node:path";
import slugify from "slugify";
import { querySqlFile, runSqlFile } from "@/lib/sqlite-runtime";
import { getSandboxSnapshot } from "@/lib/sqlite-sandbox";

const dbPath = path.join(process.cwd(), "data", "careersrx-live-resume-sandbox.sqlite");

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

function sqlString(value: string | null) {
  if (value === null) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNumber(value: number | null) {
  return value === null ? "NULL" : String(value);
}

function runSql(sql: string) {
  runSqlFile(dbPath, sql);
}

function querySql<T>(sql: string): T[] {
  return querySqlFile<T>(dbPath, sql);
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

function uniqueSlug(table: "local_companies" | "local_jobs", base: string, excludeId?: string) {
  const root = slugBase(base);
  let candidate = root;
  let suffix = 2;
  while (true) {
    const [row] = querySql<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE slug = ${sqlString(candidate)}${
        excludeId ? ` AND id != ${sqlString(excludeId)}` : ""
      }`,
    );
    if (!row?.count) return candidate;
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
}

export function initializeLocalPlatform() {
  runSql(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS local_companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      website TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      verification_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_company_users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      user_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_jobs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      facility_type TEXT,
      job_type TEXT NOT NULL,
      shifts_json TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT NOT NULL,
      description TEXT NOT NULL,
      requirements TEXT NOT NULL,
      benefits TEXT NOT NULL,
      salary_min_cents INTEGER,
      salary_max_cents INTEGER,
      pay_type TEXT,
      show_salary INTEGER NOT NULL,
      eeo_statement TEXT NOT NULL,
      status TEXT NOT NULL,
      published_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      seeker_user_id TEXT NOT NULL,
      seeker_name TEXT NOT NULL,
      seeker_email TEXT NOT NULL,
      seeker_headline TEXT NOT NULL,
      seeker_location TEXT NOT NULL,
      cover_letter TEXT NOT NULL,
      license_confirmed INTEGER NOT NULL,
      profile_snapshot_json TEXT NOT NULL,
      resume_snapshot_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(job_id, seeker_user_id)
    );

    CREATE TABLE IF NOT EXISTS local_saved_jobs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      seeker_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(job_id, seeker_user_id)
    );
  `);
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
    facilityType: row.facility_type === null ? null : String(row.facility_type ?? ""),
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
    payType: row.pay_type === null ? null : String(row.pay_type ?? ""),
    showSalary: Number(row.show_salary ?? 0) === 1,
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
    licenseConfirmed: Number(row.license_confirmed ?? 0) === 1,
    status: String(row.application_status ?? row.status ?? "PENDING") as LocalApplication["status"],
    createdAt: new Date(String(row.application_created_at ?? row.created_at ?? now())),
    profileSnapshot: parseJson<Record<string, unknown>>(row.profile_snapshot_json, {}),
    resumeSnapshot: parseJson<Record<string, unknown>>(row.resume_snapshot_json, {}),
    job: mapJob(row),
  };
}

function jobSelect(where: string, order = "j.created_at DESC") {
  return querySql<Row>(`
    SELECT
      j.*,
      c.name AS company_name,
      c.slug AS company_slug,
      c.website AS company_website
    FROM local_jobs j
    JOIN local_companies c ON c.id = j.company_id
    WHERE ${where}
    ORDER BY ${order}
  `).map(mapJob);
}

export function createLocalCompanyForOwner(input: {
  ownerUserId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
}) {
  initializeLocalPlatform();
  const timestamp = now();
  const companyId = randomBytes(16).toString("hex");
  const company = {
    id: companyId,
    name: input.companyName.trim(),
    slug: uniqueSlug("local_companies", input.companyName),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
  };

  runSql(`
    INSERT INTO local_companies (id, name, slug, contact_name, contact_email, verification_status, created_at, updated_at)
    VALUES (${[
      sqlString(company.id),
      sqlString(company.name),
      sqlString(company.slug),
      sqlString(company.contactName),
      sqlString(company.contactEmail),
      sqlString("APPROVED"),
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")});

    INSERT INTO local_company_users (id, company_id, user_id, role, created_at)
    VALUES (${[
      sqlString(randomBytes(16).toString("hex")),
      sqlString(company.id),
      sqlString(input.ownerUserId),
      sqlString("OWNER"),
      sqlString(timestamp),
    ].join(", ")});
  `);

  return getCompanyForUser(input.ownerUserId);
}

export function getCompanyForUser(userId: string) {
  initializeLocalPlatform();
  const [row] = querySql<Row>(`
    SELECT c.*
    FROM local_companies c
    JOIN local_company_users cu ON cu.company_id = c.id
    WHERE cu.user_id = ${sqlString(userId)}
    LIMIT 1
  `);
  return row ? mapCompany(row) : null;
}

export function updateCompanyForUser(userId: string, input: Partial<LocalCompany>) {
  const company = getCompanyForUser(userId);
  if (!company) return null;
  const name = text(input.name) || company.name;
  const timestamp = now();
  runSql(`
    UPDATE local_companies
    SET
      name = ${sqlString(name)},
      slug = ${sqlString(name === company.name ? company.slug : uniqueSlug("local_companies", name, company.id))},
      website = ${sqlString(optionalText(input.website))},
      phone = ${sqlString(optionalText(input.phone))},
      description = ${sqlString(optionalText(input.description))},
      contact_name = ${sqlString(text(input.contactName) || company.contactName)},
      contact_email = ${sqlString(text(input.contactEmail).toLowerCase() || company.contactEmail)},
      updated_at = ${sqlString(timestamp)}
    WHERE id = ${sqlString(company.id)}
  `);
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

export function listJobsForCompany(companyId: string) {
  initializeLocalPlatform();
  return jobSelect(`j.company_id = ${sqlString(companyId)}`, "j.updated_at DESC");
}

export function getJobForCompany(jobId: string, companyId: string) {
  initializeLocalPlatform();
  return jobSelect(`j.id = ${sqlString(jobId)} AND j.company_id = ${sqlString(companyId)}`, "j.created_at DESC")[0] ?? null;
}

export function createJobForCompany(companyId: string, input: LocalJobInput) {
  initializeLocalPlatform();
  const parsed = normalizeJobInput(input);
  if (!parsed.ok) return parsed;
  const timestamp = now();
  const jobId = randomBytes(16).toString("hex");
  const slug = uniqueSlug("local_jobs", `${parsed.job.title}-${parsed.job.city}-${parsed.job.state}`);
  runSql(`
    INSERT INTO local_jobs (
      id, company_id, slug, title, category, facility_type, job_type, shifts_json, city, state, zip,
      description, requirements, benefits, salary_min_cents, salary_max_cents, pay_type,
      show_salary, eeo_statement, status, published_at, expires_at, created_at, updated_at
    ) VALUES (${[
      sqlString(jobId),
      sqlString(companyId),
      sqlString(slug),
      sqlString(parsed.job.title),
      sqlString(parsed.job.category),
      sqlString(parsed.job.facilityType),
      sqlString(parsed.job.jobType),
      sqlString(JSON.stringify(parsed.job.shifts)),
      sqlString(parsed.job.city),
      sqlString(parsed.job.state),
      sqlString(parsed.job.zip),
      sqlString(parsed.job.description),
      sqlString(parsed.job.requirements),
      sqlString(parsed.job.benefits),
      sqlNumber(parsed.job.salaryMinCents),
      sqlNumber(parsed.job.salaryMaxCents),
      sqlString(parsed.job.payType),
      parsed.job.showSalary ? "1" : "0",
      sqlString(parsed.job.eeoStatement),
      sqlString("DRAFT"),
      "NULL",
      "NULL",
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})
  `);
  return { ok: true as const, job: getJobForCompany(jobId, companyId)! };
}

export function updateJobForCompany(jobId: string, companyId: string, input: LocalJobInput) {
  const existing = getJobForCompany(jobId, companyId);
  if (!existing) return { ok: false as const, error: "Job not found" };
  const merged = { ...existing, ...input };
  const parsed = normalizeJobInput(merged);
  if (!parsed.ok) return parsed;
  const timestamp = now();
  runSql(`
    UPDATE local_jobs
    SET
      title = ${sqlString(parsed.job.title)},
      category = ${sqlString(parsed.job.category)},
      facility_type = ${sqlString(parsed.job.facilityType)},
      job_type = ${sqlString(parsed.job.jobType)},
      shifts_json = ${sqlString(JSON.stringify(parsed.job.shifts))},
      city = ${sqlString(parsed.job.city)},
      state = ${sqlString(parsed.job.state)},
      zip = ${sqlString(parsed.job.zip)},
      description = ${sqlString(parsed.job.description)},
      requirements = ${sqlString(parsed.job.requirements)},
      benefits = ${sqlString(parsed.job.benefits)},
      salary_min_cents = ${sqlNumber(parsed.job.salaryMinCents)},
      salary_max_cents = ${sqlNumber(parsed.job.salaryMaxCents)},
      pay_type = ${sqlString(parsed.job.payType)},
      show_salary = ${parsed.job.showSalary ? "1" : "0"},
      eeo_statement = ${sqlString(parsed.job.eeoStatement)},
      updated_at = ${sqlString(timestamp)}
    WHERE id = ${sqlString(jobId)} AND company_id = ${sqlString(companyId)}
  `);
  return { ok: true as const, job: getJobForCompany(jobId, companyId)! };
}

export function setJobStatusForCompany(jobId: string, companyId: string, status: LocalJobStatus) {
  const job = getJobForCompany(jobId, companyId);
  if (!job) return null;
  const timestamp = now();
  const publishedAt = status === "ACTIVE" ? job.publishedAt?.toISOString() ?? timestamp : job.publishedAt?.toISOString() ?? null;
  runSql(`
    UPDATE local_jobs
    SET status = ${sqlString(status)}, published_at = ${sqlString(publishedAt)}, updated_at = ${sqlString(timestamp)}
    WHERE id = ${sqlString(jobId)} AND company_id = ${sqlString(companyId)}
  `);
  return getJobForCompany(jobId, companyId);
}

export function listPublicJobs(filters: {
  q?: string;
  category?: string;
  state?: string;
  jobType?: string;
  page?: number;
  pageSize?: number;
}) {
  initializeLocalPlatform();
  const clauses = [`j.status = ${sqlString("ACTIVE")}`];
  if (filters.state) clauses.push(`j.state = ${sqlString(filters.state)}`);
  if (filters.category) clauses.push(`j.category = ${sqlString(filters.category)}`);
  if (filters.jobType) clauses.push(`j.job_type = ${sqlString(filters.jobType)}`);
  if (filters.q) {
    const q = `%${filters.q.replaceAll("%", "").replaceAll("_", "")}%`;
    clauses.push(`(j.title LIKE ${sqlString(q)} OR j.description LIKE ${sqlString(q)} OR j.city LIKE ${sqlString(q)} OR c.name LIKE ${sqlString(q)})`);
  }
  const where = clauses.join(" AND ");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 12;
  const [countRow] = querySql<{ count: number }>(`
    SELECT COUNT(*) AS count
    FROM local_jobs j
    JOIN local_companies c ON c.id = j.company_id
    WHERE ${where}
  `);
  const jobs = querySql<Row>(`
    SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.website AS company_website
    FROM local_jobs j
    JOIN local_companies c ON c.id = j.company_id
    WHERE ${where}
    ORDER BY j.published_at DESC, j.created_at DESC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `).map(mapJob);
  return { jobs, total: Number(countRow?.count ?? 0) };
}

export function getPublicJobStats() {
  initializeLocalPlatform();
  const [jobRow] = querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM local_jobs WHERE status = ${sqlString("ACTIVE")}`,
  );
  const [companyRow] = querySql<{ count: number }>(`
    SELECT COUNT(DISTINCT company_id) AS count
    FROM local_jobs
    WHERE status = ${sqlString("ACTIVE")}
  `);
  return {
    jobCount: Number(jobRow?.count ?? 0),
    companyCount: Number(companyRow?.count ?? 0),
  };
}

export function getPublicJobBySlug(slug: string) {
  initializeLocalPlatform();
  return jobSelect(`j.slug = ${sqlString(slug)} AND j.status = ${sqlString("ACTIVE")}`, "j.created_at DESC")[0] ?? null;
}

export function listRelatedPublicJobs(job: LocalJob, take = 3) {
  initializeLocalPlatform();
  return querySql<Row>(`
    SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.website AS company_website
    FROM local_jobs j
    JOIN local_companies c ON c.id = j.company_id
    WHERE j.status = ${sqlString("ACTIVE")} AND j.category = ${sqlString(job.category)} AND j.id != ${sqlString(job.id)}
    ORDER BY j.published_at DESC, j.created_at DESC
    LIMIT ${take}
  `).map(mapJob);
}

export function createApplication(input: {
  jobId: string;
  seekerUserId: string;
  seekerEmail: string;
  sandboxId: string;
  coverLetter?: string;
  licenseConfirmed?: boolean;
}) {
  initializeLocalPlatform();
  const job = jobSelect(`j.id = ${sqlString(input.jobId)} AND j.status = ${sqlString("ACTIVE")}`, "j.created_at DESC")[0];
  if (!job) return { ok: false as const, error: "This job is not accepting applications" };

  const existing = querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM local_applications WHERE job_id = ${sqlString(job.id)} AND seeker_user_id = ${sqlString(input.seekerUserId)}`,
  )[0];
  if (existing?.count) return { ok: false as const, error: "You already applied to this job" };

  const snapshot = getSandboxSnapshot(input.sandboxId);
  const timestamp = now();
  const id = randomBytes(16).toString("hex");
  runSql(`
    INSERT INTO local_applications (
      id, job_id, seeker_user_id, seeker_name, seeker_email, seeker_headline, seeker_location,
      cover_letter, license_confirmed, profile_snapshot_json, resume_snapshot_json, status, created_at, updated_at
    ) VALUES (${[
      sqlString(id),
      sqlString(job.id),
      sqlString(input.seekerUserId),
      sqlString(snapshot.profile.fullName || input.seekerEmail),
      sqlString(snapshot.profile.email || input.seekerEmail),
      sqlString(snapshot.profile.headline),
      sqlString(snapshot.profile.location),
      sqlString(optionalText(input.coverLetter)),
      input.licenseConfirmed ? "1" : "0",
      sqlString(JSON.stringify(snapshot.profile)),
      sqlString(JSON.stringify(snapshot.resume)),
      sqlString("PENDING"),
      sqlString(timestamp),
      sqlString(timestamp),
    ].join(", ")})
  `);
  return { ok: true as const, application: getApplication(id)! };
}

export function getApplication(id: string) {
  initializeLocalPlatform();
  const [row] = querySql<Row>(`
    SELECT
      a.id AS application_id,
      a.status AS application_status,
      a.created_at AS application_created_at,
      a.*,
      j.*,
      c.name AS company_name,
      c.slug AS company_slug,
      c.website AS company_website
    FROM local_applications a
    JOIN local_jobs j ON j.id = a.job_id
    JOIN local_companies c ON c.id = j.company_id
    WHERE a.id = ${sqlString(id)}
    LIMIT 1
  `);
  return row ? mapApplication(row) : null;
}

export function listApplicationsForSeeker(userId: string) {
  initializeLocalPlatform();
  return querySql<Row>(`
    SELECT
      a.id AS application_id,
      a.status AS application_status,
      a.created_at AS application_created_at,
      a.*,
      j.*,
      c.name AS company_name,
      c.slug AS company_slug,
      c.website AS company_website
    FROM local_applications a
    JOIN local_jobs j ON j.id = a.job_id
    JOIN local_companies c ON c.id = j.company_id
    WHERE a.seeker_user_id = ${sqlString(userId)}
    ORDER BY a.created_at DESC
  `).map(mapApplication);
}

export function listApplicationsForCompany(companyId: string, jobId?: string) {
  initializeLocalPlatform();
  return querySql<Row>(`
    SELECT
      a.id AS application_id,
      a.status AS application_status,
      a.created_at AS application_created_at,
      a.*,
      j.*,
      c.name AS company_name,
      c.slug AS company_slug,
      c.website AS company_website
    FROM local_applications a
    JOIN local_jobs j ON j.id = a.job_id
    JOIN local_companies c ON c.id = j.company_id
    WHERE j.company_id = ${sqlString(companyId)}${jobId ? ` AND j.id = ${sqlString(jobId)}` : ""}
    ORDER BY a.created_at DESC
  `).map(mapApplication);
}

export function listSavedJobsForSeeker(userId: string) {
  initializeLocalPlatform();
  return querySql<Row>(`
    SELECT j.*, c.name AS company_name, c.slug AS company_slug, c.website AS company_website
    FROM local_saved_jobs s
    JOIN local_jobs j ON j.id = s.job_id
    JOIN local_companies c ON c.id = j.company_id
    WHERE s.seeker_user_id = ${sqlString(userId)} AND j.status = ${sqlString("ACTIVE")}
    ORDER BY s.created_at DESC
  `).map(mapJob);
}

export function isJobSaved(userId: string, jobId: string) {
  initializeLocalPlatform();
  const [row] = querySql<{ count: number }>(
    `SELECT COUNT(*) AS count FROM local_saved_jobs WHERE seeker_user_id = ${sqlString(userId)} AND job_id = ${sqlString(jobId)}`,
  );
  return Number(row?.count ?? 0) > 0;
}

export function saveJobForSeeker(userId: string, jobId: string) {
  initializeLocalPlatform();
  const timestamp = now();
  runSql(`
    INSERT OR IGNORE INTO local_saved_jobs (id, job_id, seeker_user_id, created_at)
    VALUES (${[
      sqlString(randomBytes(16).toString("hex")),
      sqlString(jobId),
      sqlString(userId),
      sqlString(timestamp),
    ].join(", ")})
  `);
  return { saved: true };
}

export function removeSavedJobForSeeker(userId: string, jobId: string) {
  initializeLocalPlatform();
  runSql(`DELETE FROM local_saved_jobs WHERE seeker_user_id = ${sqlString(userId)} AND job_id = ${sqlString(jobId)}`);
  return { saved: false };
}
