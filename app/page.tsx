import Link from "next/link";
import { connection } from "next/server";
import { Search, Heart, ShieldCheck, Users, ArrowRight } from "lucide-react";
import { getPublicJobStats, listPublicJobs } from "@/lib/local-platform";
import { Button } from "@/components/ui/Button";
import { JobCard } from "@/components/jobs/JobCard";
import { JOB_CATEGORIES, FOCUS_STATES } from "@/lib/constants";

export default async function HomePage() {
  await connection();
  const { jobs: featuredJobs } = listPublicJobs({ page: 1, pageSize: 6 });
  const { jobCount, companyCount } = getPublicJobStats();

  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-primary-light to-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Keep your career profile{" "}
              <span className="text-primary">application-ready</span>
            </h1>
            <p className="mt-5 text-lg text-muted sm:text-xl">
              CareersRX starts with healthcare and senior care jobs, then connects your
              profile, live résumé, and application materials so every next move is easier.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/register/seeker" size="lg">
                Create Account + Live Résumé
              </Button>
              <Button href="/register/employer" variant="outline" size="lg">
                Post a Job
              </Button>
            </div>

            <form
              action="/jobs"
              className="mx-auto mt-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:flex-row"
            >
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search size={20} className="shrink-0 text-muted" />
                <input
                  type="text"
                  name="q"
                  placeholder="Job title, keyword, or company"
                  aria-label="Search jobs"
                  className="w-full bg-transparent py-2.5 text-base outline-none placeholder:text-muted"
                />
              </div>
              <Button type="submit" size="md" className="sm:w-auto">
                Search Jobs
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-muted">Popular:</span>
              {["Registered Nurse", "CNA", "Caregiver", "Memory Care"].map((term) => (
                <Link
                  key={term}
                  href={`/jobs?q=${encodeURIComponent(term)}`}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-foreground hover:border-primary hover:text-primary"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-border px-4 sm:px-6">
          {[
            { value: `${jobCount}+`, label: "Open positions" },
            { value: `${companyCount}+`, label: "Communities hiring" },
            { value: `${FOCUS_STATES.length}`, label: "States served" },
          ].map((stat) => (
            <div key={stat.label} className="px-2 py-8 text-center">
              <div className="text-3xl font-bold text-primary sm:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured jobs ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Latest healthcare opportunities
            </h2>
            <p className="mt-1 text-muted">Fresh roles from the first CareersRX vertical.</p>
          </div>
          <Button href="/jobs" variant="outline" size="sm" className="shrink-0">
            View all <ArrowRight size={16} />
          </Button>
        </div>

        {featuredJobs.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-lg font-semibold text-foreground">The first CareersRX postings are coming together.</h3>
            <p className="mt-2 max-w-2xl text-muted">
              Employers can create an account, save a posting, and publish it when it is ready. Job seekers can
              create a profile now and come back as new openings go live.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button href="/register/seeker">Create a Profile</Button>
              <Button href="/register/employer" variant="outline">
                Create Employer Account
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredJobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
        )}
      </section>

      {/* ── How it works ── */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Why CareersRX
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Heart,
                title: "Healthcare first",
                body: "We’re starting with assisted living, memory care, skilled nursing, hospice, and related communities before expanding into more fields.",
              },
              {
                icon: ShieldCheck,
                title: "Employer-owned postings",
                body: "Employers manage their own company workspace and choose when a saved posting is ready to publish.",
              },
              {
                icon: Users,
                title: "Career profile ready",
                body: "A live profile and résumé system designed to keep candidates ready for applications without repetitive data entry.",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <feature.icon size={28} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Browse by category ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Browse by role</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/jobs?category=${encodeURIComponent(cat)}`}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Employer CTA ── */}
      <section className="bg-primary">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Hiring in healthcare?
              </h2>
              <p className="mt-2 text-primary-light">
                Reach compassionate, qualified candidates in our first vertical. Post your
                first job free.
              </p>
            </div>
            <Button href="/employers" variant="secondary" size="lg" className="shrink-0">
              Post a Job
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
