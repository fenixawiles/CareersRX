import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getCompanyForUser } from "@/lib/local-platform";

export default async function EmployerAccountPage() {
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "EMPLOYER") redirect("/login?next=/dashboard/employer/account");
  const company = getCompanyForUser(user.id);

  return (
    <div className="space-y-6">
      <DashboardHeading title="Account settings" action={<LogoutButton />} />

      <Card>
        <h2 className="font-semibold text-foreground">Account</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info label="Name" value={user.fullName} />
          <Info label="Email" value={user.email} />
          <Info label="Role" value="Employer owner" />
          <Info label="Company" value={company?.name ?? "Company profile needed"} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Hiring notifications</h2>
        <p className="mt-1 text-sm text-muted">
          Email notifications are not enabled yet. Applicant activity stays visible in your dashboard.
        </p>
        <div className="mt-3">
          <Button href="/dashboard/employer/jobs" variant="outline" size="sm">
            Review Jobs
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
