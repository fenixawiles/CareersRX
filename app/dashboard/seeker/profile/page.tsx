import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardUI";
import { PublicProfilePreview } from "@/components/demo/PublicProfilePreview";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { getSandboxSnapshot } from "@/lib/sqlite-sandbox";

export default async function SeekerProfilePage() {
  const user = await getCurrentLocalUser();
  if (!user) redirect("/login?next=/dashboard/seeker/profile");

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Your public profile"
        description="This is the professional profile employers would see. Update it by editing and syncing your live résumé."
      />

      <PublicProfilePreview
        snapshot={getSandboxSnapshot(sandboxIdForUser(user.id))}
        resumeHref="/dashboard/seeker/resume"
        signupHref="/dashboard/seeker/account"
        signupLabel="Account Settings"
        emptyDescription="Your account exists, but no profile details have been created yet. Use your live résumé workspace to add details and approve profile syncs."
      />
    </div>
  );
}
