import { redirect } from "next/navigation";
import { FilePenLine, UserRound, BriefcaseBusiness } from "lucide-react";
import { DashboardHeading, StatCard, Card } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { getSandboxSnapshot } from "@/lib/sqlite-sandbox";

export default async function SeekerOverview() {
  const user = await getCurrentLocalUser();
  if (!user) redirect("/login?next=/dashboard/seeker");

  const snapshot = getSandboxSnapshot(sandboxIdForUser(user.id));
  const syncedSections = snapshot.resume.sections.filter((section) => section.syncStatus === "SYNCED").length;
  const pendingProposals = snapshot.proposals.filter((proposal) => proposal.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <DashboardHeading
        title={`Welcome back, ${user.firstName}`}
        description="Your CareersRX profile, live résumé, and applications are connected in one workspace."
        action={
          <Button href="/dashboard/seeker/resume" size="sm">
            <FilePenLine size={16} /> Open Live Résumé
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Profile" value={snapshot.profile.fullName ? "Created" : "Incomplete"} icon={UserRound} />
        <StatCard label="Synced sections" value={`${syncedSections}/${snapshot.resume.sections.length}`} icon={FilePenLine} />
        <StatCard label="Pending syncs" value={pendingProposals} icon={BriefcaseBusiness} />
      </div>

      <Card className="border-primary/20 bg-primary-light/40">
        <h2 className="font-semibold text-foreground">How to use this flow</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Your public profile is separate from the live résumé. Edit a résumé section,
          click Save Section, then approve whether the detail should update the public
          profile or stay résumé-only.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button href="/dashboard/seeker/profile" variant="outline" size="sm">
            View Public Profile
          </Button>
          <Button href="/dashboard/seeker/resume" size="sm">
            Edit Live Résumé
          </Button>
        </div>
      </Card>
    </div>
  );
}
