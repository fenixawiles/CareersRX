import { Badge } from "@/components/ui/Badge";

const APPLICATION_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "primary" | "accent" | "success" | "warning" | "danger" }
> = {
  PENDING: { label: "Pending", tone: "neutral" },
  REVIEWED: { label: "Reviewed", tone: "primary" },
  PHONE_SCREEN: { label: "Phone Screen", tone: "accent" },
  INTERVIEW: { label: "Interview", tone: "accent" },
  OFFERED: { label: "Offered", tone: "success" },
  HIRED: { label: "Hired", tone: "success" },
  REJECTED: { label: "Not Selected", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

const JOB_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "primary" | "accent" | "success" | "warning" | "danger" }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_REVIEW: { label: "Pending Review", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  PAUSED: { label: "Paused", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const COMPANY_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "primary" | "accent" | "success" | "warning" | "danger" }
> = {
  PENDING: { label: "Pending Verification", tone: "warning" },
  APPROVED: { label: "Verified", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

export function ApplicationStatusBadge({ status }: { status: string }) {
  const s = APPLICATION_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function JobStatusBadge({ status }: { status: string }) {
  const s = JOB_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function CompanyStatusBadge({ status }: { status: string }) {
  const s = COMPANY_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
