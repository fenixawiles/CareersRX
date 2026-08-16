import Link from "next/link";
import { connection } from "next/server";
import { Globe, Phone, Mail } from "lucide-react";
import { adminCompanies } from "@/lib/admin/queries";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";
import { requireAdmin } from "@/lib/auth/policy";

export default async function AdminEmployers() {
  await requireAdmin();
  await connection();

  const companies = await adminCompanies();

  return (
    <div className="space-y-6">
      <DashboardHeading title="Employers" description={`${companies.length} communities`} />

      <div className="space-y-3">
        {companies.map((company) => (
          <Card key={company.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/employers/${company.id}`}
                    className="text-lg font-semibold text-foreground hover:text-primary"
                  >
                    {company.name}
                  </Link>
                  <CompanyStatusBadge status={company.verificationStatus} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  {company.website ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Globe size={14} /> {company.website.replace(/^https?:\/\//, "")}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={14} /> {company.contactEmail}
                  </span>
                  {company.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} /> {company.phone}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {company.jobCount} jobs · {company.memberCount} team members
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
