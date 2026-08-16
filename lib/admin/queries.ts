import "server-only";

import { query, queryOne } from "@/lib/db/sql";

type Row = Record<string, unknown>;

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  role: "SEEKER" | "EMPLOYER";
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
};

export type AdminCompanyRow = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  website: string;
  phone: string;
  description: string;
  verificationStatus: string;
  jobCount: number;
  memberCount: number;
  createdAt: string;
};

export type AdminJobRow = {
  id: string;
  slug: string;
  title: string;
  city: string;
  state: string;
  status: string;
  companyName: string;
  publishedAt: string | null;
};

export type AdminAuditRow = {
  id: string;
  eventType: string;
  actorKind: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export async function adminOverview() {
  const [companies, jobs, users] = await Promise.all([
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM companies"),
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('DRAFT', 'PENDING_REVIEW')"),
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM users"),
  ]);
  const recentCompanies = await adminCompanies(5);
  return {
    companyCount: Number(companies?.count ?? 0),
    unpublishedJobCount: Number(jobs?.count ?? 0),
    userCount: Number(users?.count ?? 0),
    recentCompanies,
  };
}

export async function adminUsers(): Promise<AdminUserRow[]> {
  const rows = await query<Row>("SELECT * FROM users ORDER BY created_at DESC");
  return rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    role: row.role === "EMPLOYER" ? "EMPLOYER" : "SEEKER",
    isAdmin: row.is_admin === true,
    emailVerified: row.email_verified_at != null,
    createdAt: String(row.created_at),
  }));
}

export async function adminCompanies(limit?: number): Promise<AdminCompanyRow[]> {
  const rows = await query<Row>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) AS job_count,
       (SELECT COUNT(*) FROM company_users cu WHERE cu.company_id = c.id AND cu.revoked_at IS NULL) AS member_count
     FROM companies c
     ORDER BY c.created_at DESC
     ${limit ? "LIMIT ?" : ""}`,
    limit ? [limit] : [],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    contactEmail: String(row.contact_email),
    website: String(row.website ?? ""),
    phone: String(row.phone ?? ""),
    description: String(row.description ?? ""),
    verificationStatus: String(row.verification_status),
    jobCount: Number(row.job_count ?? 0),
    memberCount: Number(row.member_count ?? 0),
    createdAt: String(row.created_at),
  }));
}

export async function adminCompanyById(id: string) {
  const companies = await query<Row>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) AS job_count
     FROM companies c WHERE c.id = ?`,
    [id],
  );
  const company = companies[0];
  if (!company) return null;
  const members = await query<Row>(
    `SELECT u.full_name, u.email, cu.role
     FROM company_users cu JOIN users u ON u.id = cu.user_id
     WHERE cu.company_id = ? AND cu.revoked_at IS NULL
     ORDER BY cu.created_at ASC`,
    [id],
  );
  return {
    id: String(company.id),
    name: String(company.name),
    contactEmail: String(company.contact_email),
    website: String(company.website ?? ""),
    phone: String(company.phone ?? ""),
    description: String(company.description ?? ""),
    verificationStatus: String(company.verification_status),
    jobCount: Number(company.job_count ?? 0),
    members: members.map((member) => ({
      fullName: String(member.full_name),
      email: String(member.email),
      role: String(member.role),
    })),
  };
}

export async function adminJobs(limit = 40): Promise<AdminJobRow[]> {
  const rows = await query<Row>(
    `SELECT j.id, j.slug, j.title, j.city, j.state, j.status, j.published_at, c.name AS company_name
     FROM jobs j JOIN companies c ON c.id = j.company_id
     ORDER BY j.published_at DESC NULLS LAST, j.created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    city: String(row.city),
    state: String(row.state),
    status: String(row.status),
    companyName: String(row.company_name),
    publishedAt: row.published_at ? String(row.published_at) : null,
  }));
}

export async function adminAuditEvents(limit = 50): Promise<AdminAuditRow[]> {
  const rows = await query<Row>(
    "SELECT id, event_type, actor_kind, entity_type, entity_id, created_at FROM audit_events ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => ({
    id: String(row.id),
    eventType: String(row.event_type),
    actorKind: String(row.actor_kind),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    createdAt: String(row.created_at),
  }));
}
