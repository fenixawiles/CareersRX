import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminCompanyById } from "@/lib/admin/queries";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth/policy";

type Params = Promise<{ id: string }>;

export default async function AdminEmployerDetail({ params }: { params: Params }) {
  await requireAdmin();
  await connection();

  const { id } = await params;
  const company = await adminCompanyById(id);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/employers"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to employers
      </Link>

      <DashboardHeading
        title={company.name}
        action={<CompanyStatusBadge status={company.verificationStatus} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-foreground">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Website" value={company.website || "—"} />
              <Row label="Email" value={company.contactEmail} />
              <Row label="Phone" value={company.phone || "—"} />
              <Row label="Jobs posted" value={String(company.jobCount)} />
            </dl>
            {company.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{company.description}</p>
            ) : null}
          </Card>
        </div>

        <Card>
          <h2 className="font-semibold text-foreground">Team</h2>
          <ul className="mt-3 space-y-3">
            {company.members.map((member) => (
              <li key={member.email} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{member.fullName}</p>
                  <p className="truncate text-muted">{member.email}</p>
                </div>
                <Badge tone="neutral">{member.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
