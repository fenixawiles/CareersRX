import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Building2,
  DollarSign,
  CalendarClock,
  BadgeCheck,
  Award,
  ArrowLeft,
} from "lucide-react";
import { getCurrentLocalUser } from "@/lib/local-auth";
import { getPublicJobBySlug, isJobSaved, listRelatedPublicJobs } from "@/lib/local-platform";
import { Badge } from "@/components/ui/Badge";
import { JobStructuredData } from "@/components/jobs/JobStructuredData";
import { JobCard } from "@/components/jobs/JobCard";
import { ApplyButton } from "@/components/jobs/ApplyButton";
import {
  JOB_TYPE_LABELS,
  SHIFT_LABELS,
  FACILITY_TYPE_LABELS,
} from "@/lib/constants";
import { formatSalaryRange, formatCents, postedAgo } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

async function getJob(slug: string) {
  return getPublicJobBySlug(slug);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) {
    return { title: "Job Not Available" };
  }
  return {
    title: `${job.title} — ${job.company.name}`,
    description: `${job.title} in ${job.city}, ${job.state} at ${job.company.name}. Apply on CareersRX.`,
    alternates: { canonical: `/jobs/${job.slug}` },
  };
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) notFound();

  const salary = formatSalaryRange(job);
  const user = await getCurrentLocalUser();
  const saved = user?.role === "SEEKER" ? isJobSaved(user.id, job.id) : false;
  const relatedJobs = listRelatedPublicJobs(job);

  return (
    <>
      <JobStructuredData job={job} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
        >
          <ArrowLeft size={16} /> Back to all jobs
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main */}
          <div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{job.title}</h1>
                  <p className="mt-2 flex items-center gap-1.5 text-muted">
                    <Building2 size={17} />
                    {job.company.name}
                    {job.company.verificationStatus === "APPROVED" ? (
                      <BadgeCheck size={16} className="text-primary" aria-label="Verified employer" />
                    ) : null}
                  </p>
                </div>
                {job.signOnBonusCents ? (
                  <Badge tone="accent">
                    {formatCents(job.signOnBonusCents)} sign-on bonus
                  </Badge>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={16} /> {job.city}, {job.state}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={16} /> {JOB_TYPE_LABELS[job.jobType]}
                </span>
                {salary ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-success">
                    <DollarSign size={16} /> {salary}
                  </span>
                ) : null}
                {job.publishedAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock size={16} /> {postedAgo(job.publishedAt)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {job.facilityType ? (
                  <Badge tone="neutral">{FACILITY_TYPE_LABELS[job.facilityType]}</Badge>
                ) : null}
                {job.shifts.map((s) => (
                  <Badge key={s} tone="neutral">
                    {SHIFT_LABELS[s]} shift
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description sections (seed content is trusted HTML; employer-submitted
                content is sanitized server-side at creation in a later phase) */}
            <article className="prose-job mt-6 rounded-2xl border border-border bg-surface p-6">
              <TextBlock content={job.description} />
              {job.requirements ? (
                <>
                  <h2>Requirements</h2>
                  <TextBlock content={job.requirements} />
                </>
              ) : null}
              {job.benefits ? (
                <>
                  <h2>Benefits</h2>
                  <TextBlock content={job.benefits} />
                </>
              ) : null}

              {job.requirements ? (
                <>
                  <h2>Credentials</h2>
                  <div className="not-prose flex flex-wrap gap-2">
                    <Badge tone="primary" icon={<Award size={13} />}>
                      Review requirements before applying
                    </Badge>
                  </div>
                </>
              ) : null}

              <h2>Equal Opportunity</h2>
              <p className="text-sm text-muted">{job.eeoStatement}</p>
            </article>
          </div>

          {/* Sidebar — sticky apply */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold text-foreground">Ready to apply?</h2>
              <p className="mt-1 text-sm text-muted">
                Send your application in just a minute.
              </p>
              <div className="mt-4">
                <ApplyButton
                  jobId={job.id}
                  jobTitle={job.title}
                  companyName={job.company.name}
                  initiallySaved={saved}
                  canApply={user?.role === "SEEKER"}
                />
              </div>
              <div className="mt-5 border-t border-border pt-4 text-sm text-muted">
                <p className="flex items-center gap-1.5">
                  <BadgeCheck size={15} className="text-primary" /> Verified employer
                </p>
                <Link
                  href="/safety"
                  className="mt-2 inline-block text-xs underline hover:text-foreground"
                >
                  Job seeker safety tips
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {/* Related jobs */}
        {relatedJobs.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground">Similar roles</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedJobs.map((rj) => (
                <JobCard key={rj.id} job={rj} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function TextBlock({ content }: { content: string }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
      {content}
    </div>
  );
}
