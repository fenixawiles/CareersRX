import { JOB_TYPE_LABELS } from "@/lib/constants";

type Job = {
  title: string;
  description: string;
  city: string;
  state: string;
  jobType: string;
  publishedAt: Date | null;
  expiresAt: Date | null;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  payType: string | null;
  showSalary: boolean;
  company: { name: string; website: string | null };
};

// Google JobPosting structured data. Only render for ACTIVE jobs.
export function JobStructuredData({ job }: { job: Job }) {
  const employmentType: Record<string, string> = {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACTOR",
    PRN: "PER_DIEM",
    PER_DIEM: "PER_DIEM",
    INTERNSHIP: "INTERN",
    VOLUNTEER: "VOLUNTEER",
  };

  const unitText: Record<string, string> = {
    HOURLY: "HOUR",
    ANNUAL: "YEAR",
    PER_DIEM: "DAY",
  };

  const data: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.publishedAt?.toISOString(),
    validThrough: job.expiresAt?.toISOString(),
    employmentType: employmentType[job.jobType] ?? "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      ...(job.company.website ? { sameAs: job.company.website } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.state,
        addressCountry: "US",
      },
    },
  };

  if (job.showSalary && (job.salaryMinCents || job.salaryMaxCents) && job.payType) {
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: {
        "@type": "QuantitativeValue",
        ...(job.salaryMinCents ? { minValue: job.salaryMinCents / 100 } : {}),
        ...(job.salaryMaxCents ? { maxValue: job.salaryMaxCents / 100 } : {}),
        unitText: unitText[job.payType] ?? "HOUR",
      },
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Re-export for label use elsewhere if needed
export { JOB_TYPE_LABELS };
