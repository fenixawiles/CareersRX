import { connection } from "next/server";
import { Bookmark } from "lucide-react";
import { getDemoSeeker } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";
import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/Button";

export default async function SeekerSaved() {
  await connection();

  const seeker = await getDemoSeeker();
  if (!seeker) return null;

  const saved = await prisma.savedJob.findMany({
    where: { seekerId: seeker.id },
    orderBy: { savedAt: "desc" },
    include: { job: { include: { company: { select: { name: true, logoUrl: true } } } } },
  });

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
            <JobCard key={s.jobId} job={s.job} />
          ))}
        </div>
      )}
    </div>
  );
}
