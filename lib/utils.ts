import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a cents value as a USD string, e.g. 1850 -> "$18.50". */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  const dollars = cents / 100;
  // Whole-dollar amounts (annual salaries) drop the cents
  const fractionDigits = Number.isInteger(dollars) ? 0 : 2;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Build a human salary range string from a job's pay fields.
 * Returns null when salary should not be shown.
 */
export function formatSalaryRange(opts: {
  salaryMinCents?: number | null;
  salaryMaxCents?: number | null;
  payType?: string | null;
  showSalary?: boolean;
}): string | null {
  const { salaryMinCents, salaryMaxCents, payType, showSalary } = opts;
  if (!showSalary) return null;
  if (salaryMinCents == null && salaryMaxCents == null) return null;

  const suffix =
    payType === "HOURLY" ? "/hr" : payType === "ANNUAL" ? "/yr" : payType === "PER_DIEM" ? "/day" : "";

  if (salaryMinCents != null && salaryMaxCents != null && salaryMinCents !== salaryMaxCents) {
    return `${formatCents(salaryMinCents)} – ${formatCents(salaryMaxCents)}${suffix}`;
  }
  return `${formatCents(salaryMinCents ?? salaryMaxCents)}${suffix}`;
}

/** Relative "posted" label, e.g. "Posted 3 days ago". */
export function postedAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Posted 1 week ago";
  if (weeks < 5) return `Posted ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "Posted 1 month ago" : `Posted ${months} months ago`;
}
