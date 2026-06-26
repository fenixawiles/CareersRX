import Link from "next/link";
import { MapPin, Clock, Building2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  JOB_TYPE_LABELS,
  FACILITY_TYPE_LABELS,
} from "@/lib/constants";
import { formatSalaryRange, postedAgo } from "@/lib/utils";

export type JobCardData = {
  slug: string;
  title: string;
  city: string;
  state: string;
  jobType: string;
  facilityType: string | null;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  payType: string | null;
  showSalary: boolean;
  signOnBonusCents: number | null;
  publishedAt: Date | null;
  company: { name: string; logoUrl: string | null };
};

export function JobCard({ job }: { job: JobCardData }) {
  const salary = formatSalaryRange(job);

  return (
    <Link
      href={`/jobs/${job.slug}`}
      className="group block rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md focus-visible:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground group-hover:text-primary">
            {job.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <Building2 size={15} className="shrink-0" />
            <span className="truncate">{job.company.name}</span>
          </p>
        </div>
        {job.signOnBonusCents ? (
          <Badge tone="accent" className="shrink-0">
            Sign-on bonus
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={15} className="shrink-0" />
          {job.city}, {job.state}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} className="shrink-0" />
          {JOB_TYPE_LABELS[job.jobType] ?? job.jobType}
        </span>
        {salary ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success">
            <DollarSign size={15} className="shrink-0" />
            {salary}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {job.facilityType ? (
          <Badge tone="neutral">{FACILITY_TYPE_LABELS[job.facilityType] ?? job.facilityType}</Badge>
        ) : null}
        {job.publishedAt ? (
          <span className="text-xs text-muted">{postedAgo(job.publishedAt)}</span>
        ) : null}
      </div>
    </Link>
  );
}
