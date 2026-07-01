import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { listSavedJobsForSeeker } from "@/lib/local-platform";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";
import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/Button";

export default async function SeekerSaved() {
  const user = await getCurrentLocalUser();
  if (!user || user.role !== "SEEKER") redirect("/login?next=/dashboard/seeker/saved");
  const saved = listSavedJobsForSeeker(user.id);

  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Saved jobs"
        description={`${saved.length} ${saved.length === 1 ? "job" : "jobs"} saved`}
      />

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved jobs"
          description="Tap the save button on any job to keep it here for later."
          action={
            <Button href="/jobs" size="sm">
              Browse Jobs
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {saved.map((s) => (
            <JobCard key={s.id} job={s} />
          ))}
        </div>
      )}
    </div>
  );
}
