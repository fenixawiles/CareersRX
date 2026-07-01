import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser } from "@/lib/local-platform";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { CompanyProfileForm } from "@/components/employer/CompanyProfileForm";
import { CompanyStatusBadge } from "@/components/jobs/StatusBadge";

export default async function CompanyPage() {
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "EMPLOYER") redirect("/login?next=/dashboard/employer/company");
  const company = getCompanyForUser(user.id);
  if (!company) redirect("/register/employer");

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Company profile"
        description="This is how your community appears to candidates."
        action={<CompanyStatusBadge status={company.verificationStatus} />}
      />

      <Card>
        <CompanyProfileForm company={company} />
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Building2 size={18} className="text-primary" /> Hiring presence
        </h2>
        <Card>
          <p className="text-sm leading-6 text-muted">
            Your company profile applies across your current postings. Add location-specific
            details inside each job description.
          </p>
        </Card>
      </div>
    </div>
  );
}
