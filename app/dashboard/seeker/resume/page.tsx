import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardUI";
import { LiveResumeSandbox } from "@/components/demo/LiveResumeSandbox";
import { getCurrentLocalUser, sandboxIdForUser } from "@/lib/local-auth";
import { getSandboxSnapshot } from "@/lib/sqlite-sandbox";

export default async function SeekerResumePage() {
  const user = await getCurrentLocalUser();
  if (!user) redirect("/login?next=/dashboard/seeker/resume");

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Live Résumé"
        description="Edit résumé sections, save them, then choose whether each change updates your public profile."
      />
      <LiveResumeSandbox
        initialSnapshot={getSandboxSnapshot(sandboxIdForUser(user.id))}
        apiBase="/api/account/live-resume"
        profileHref="/dashboard/seeker/profile"
        setupHref="/dashboard/seeker/account"
        setupLabel="Account Settings"
        mode="account"
      />
    </div>
  );
}
