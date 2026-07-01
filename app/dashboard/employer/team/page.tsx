import { redirect } from "next/navigation";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser } from "@/lib/local-platform";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Badge } from "@/components/ui/Badge";

export default async function TeamPage() {
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "EMPLOYER") redirect("/login?next=/dashboard/employer/team");
  const company = getCompanyForUser(user.id);
  if (!company) redirect("/register/employer");

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Team"
        description="Manage who can post jobs and review applicants."
      />

      <div className="space-y-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light font-semibold text-primary">
                {user.fullName[0]?.toUpperCase() ?? "E"}
              </div>
              <div>
                <p className="font-medium text-foreground">{user.fullName}</p>
                <p className="text-sm text-muted">{user.email}</p>
              </div>
            </div>
            <Badge tone="primary">Owner</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
