import type { Metadata } from "next";
import { Suspense } from "react";
import { Search, SearchX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/jobs/JobCard";
import { JobFilters } from "@/components/jobs/JobFilters";
import { ActiveFilters } from "@/components/jobs/ActiveFilters";
import { Button } from "@/components/ui/Button";
import type { Prisma } from "@/app/generated/prisma/client";

export const metadata: Metadata = {
  title: "Browse Jobs",
  description:
    "Search healthcare and senior care roles across the first CareersRX job vertical.",
};

const PAGE_SIZE = 12;

type SearchParams = Promise<{
  q?: string;
  category?: string;
  state?: string;
  jobType?: string;
  page?: string;
}>;

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.JobWhereInput = { status: "ACTIVE" };
  if (sp.state) where.state = sp.state;
  if (sp.category) where.category = sp.category;
  if (sp.jobType) where.jobType = sp.jobType as Prisma.JobWhereInput["jobType"];
  if (sp.q) {
    where.OR = [
      { title: { contains: sp.q, mode: "insensitive" } },
      { description: { contains: sp.q, mode: "insensitive" } },
      { city: { contains: sp.q, mode: "insensitive" } },
      { company: { is: { name: { contains: sp.q, mode: "insensitive" } } } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { company: { select: { name: true, logoUrl: true } } },
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Search bar */}
      <form action="/jobs" className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <Search size={20} className="shrink-0 text-muted" />
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Job title, keyword, or company"
            aria-label="Search jobs"
            className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted"
          />
        </div>
        {/* preserve active filters across a new keyword search */}
        {sp.state ? <input type="hidden" name="state" value={sp.state} /> : null}
        {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
        {sp.jobType ? <input type="hidden" name="jobType" value={sp.jobType} /> : null}
        <Button type="submit" size="md">
          Search
        </Button>
      </form>

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <Suspense>
            <JobFilters />
          </Suspense>
        </div>

        <div>
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                <span className="font-semibold text-foreground">{total}</span>{" "}
                {total === 1 ? "job" : "jobs"} found
              </p>
            </div>
            <Suspense>
              <ActiveFilters />
            </Suspense>
          </div>

          {jobs.length === 0 ? (
            <EmptyState query={sp.q} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} sp={sp} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <SearchX size={28} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        No jobs found{query ? ` for “${query}”` : ""}
      </h2>
      <p className="mt-1 text-muted">
        Try removing some filters or broadening your search.
      </p>
      <div className="mt-5">
        <Button href="/jobs" variant="outline" size="sm">
          Clear search & filters
        </Button>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  sp,
}: {
  page: number;
  totalPages: number;
  sp: Record<string, string | undefined>;
}) {
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    params.set("page", String(p));
    return `/jobs?${params.toString()}`;
  }

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Button href={pageUrl(page - 1)} variant="outline" size="sm">
          Previous
        </Button>
      ) : null}
      <span className="px-3 text-sm text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Button href={pageUrl(page + 1)} variant="outline" size="sm">
          Next
        </Button>
      ) : null}
    </nav>
  );
}
