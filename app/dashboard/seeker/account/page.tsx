import { redirect } from "next/navigation";
import { DashboardHeading, Card } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentLocalUser } from "@/lib/local-auth";

export default async function SeekerAccountPage() {
  const user = await getCurrentLocalUser();
  if (!user) redirect("/login?next=/dashboard/seeker/account");

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Account settings"
        description="This account is stored in this CareersRX deployment’s SQLite workspace."
        action={<LogoutButton />}
      />

      <Card>
        <h2 className="font-semibold text-foreground">Account</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info label="Name" value={user.fullName} />
          <Info label="Email" value={user.email} />
          <Info label="Role" value="Job seeker" />
          <Info label="Created" value={new Date(user.createdAt).toLocaleString()} />
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-foreground">Live résumé profile source</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Your public profile is updated by approved live résumé syncs. To change public
          profile content, edit a section in the live résumé workspace and choose Update Profile.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button href="/dashboard/seeker/resume" size="sm">
            Open Live Résumé
          </Button>
          <Button href="/dashboard/seeker/profile" variant="outline" size="sm">
            View Public Profile
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
