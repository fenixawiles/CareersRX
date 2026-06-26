import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, FileText, Mail } from "lucide-react";
import { getDemoCompany } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { DashboardHeading, Card, EmptyState } from "@/components/dashboard/DashboardUI";
import { ApplicationStatusBadge } from "@/components/jobs/StatusBadge";
import { Button } from "@/components/ui/Button";
import { postedAgo } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function ApplicantsPage({ params }: { params: Params }) {
  const { id } = await params;
  const company = await getDemoCompany();
  if (!company) return null;

  const job = await prisma.job.findFirst({
    where: { id, companyId: company.id },
    include: {
      applications: {
        orderBy: { createdAt: "desc" },
        include: { seeker: true },
      },
    },
  });

  if (!job) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/employer/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Back to jobs
      </Link>

      <DashboardHeading
        title={job.title}
        description={`${job.applications.length} ${job.applications.length === 1 ? "applicant" : "applicants"}`}
      />

      {job.applications.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No applicants yet"
          description="When candidates apply, they'll appear here for you to review."
        />
      ) : (
        <div className="space-y-3">
          {job.applications.map((app) => (
            <Card key={app.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {app.seeker.firstName} {app.seeker.lastName}
                  </h3>
                  <p className="text-sm text-muted">
                    {app.seeker.city}, {app.seeker.state} · Applied{" "}
                    {postedAgo(app.createdAt).replace("Posted ", "")}
                  </p>
                  {app.seeker.licenses.length > 0 ? (
                    <p className="mt-1 text-sm text-muted">
                      Licenses: {app.seeker.licenses.join(", ")}
                    </p>
                  ) : null}
                  {app.coverLetter ? (
                    <p className="mt-2 line-clamp-2 max-w-xl text-sm text-foreground">
                      “{app.coverLetter}”
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ApplicationStatusBadge status={app.status} />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <FileText size={14} /> Resume
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Mail size={14} /> Message
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
