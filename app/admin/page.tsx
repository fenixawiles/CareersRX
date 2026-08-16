import Link from "next/link";
import { connection } from "next/server";
import { Building2, Briefcase, Users, ArrowRight } from "lucide-react";
import { adminOverview } from "@/lib/admin/queries";
import { DashboardHeading, StatCard, Card } from "@/components/dashboard/DashboardUI";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";
import { requireAdmin } from "@/lib/auth/policy";

export default async function AdminOverview() {
  await requireAdmin();
  await connection();

  const overview = await adminOverview();

  return (
    <div className="space-y-6">
      <DashboardHeading title="Admin dashboard" description="Platform health at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Employers" value={overview.companyCount} icon={Building2} />
        <StatCard label="Unpublished jobs" value={overview.unpublishedJobCount} icon={Briefcase} />
        <StatCard label="Total users" value={overview.userCount} icon={Users} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent communities</h2>
          <Link
            href="/admin/employers"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {overview.recentCompanies.map((company) => (
            <li key={company.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <Link
                  href={`/admin/employers/${company.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {company.name}
                </Link>
                <p className="text-sm text-muted">{company.jobCount} jobs</p>
              </div>
              <CompanyStatusBadge status={company.verificationStatus} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
