import Link from "next/link";
import { cn } from "@/lib/utils";

/** CareersRX wordmark with a neutral career profile mark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 font-bold text-xl text-foreground", className)}
      aria-label="CareersRX home"
    >
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="22" height="20" rx="7" fill="var(--color-primary)" />
        <path
          d="M10 20.5c1.1-2.4 2.8-3.6 5-3.6s3.9 1.2 5 3.6"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="15" cy="12" r="3.2" fill="white" />
        <path
          d="M10 7.5V6.6C10 5.2 11.2 4 12.6 4h4.8C18.8 4 20 5.2 20 6.6v.9"
          stroke="var(--color-primary-dark)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>
        Careers<span className="text-primary">RX</span>
      </span>
    </Link>
  );
}
