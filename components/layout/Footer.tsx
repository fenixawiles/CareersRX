import { Logo } from "./Logo";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

const COLUMNS = [
  {
    heading: "Job Seekers",
    links: [
      { href: "/jobs", label: "Browse Jobs" },
      { href: "/register/seeker", label: "Create Account" },
      { href: "/safety", label: "Job Seeker Safety" },
    ],
  },
  {
    heading: "Employers",
    links: [
      { href: "/employers", label: "Post a Job" },
      { href: "/register/employer", label: "Create Company" },
      { href: "/terms/employers", label: "Employer Terms" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
      { href: "/eeo", label: "EEO Policy" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Use" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">
              {SITE_TAGLINE} Starting with healthcare and senior care jobs, built to grow
              across more industries.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="text-sm font-semibold text-foreground">{col.heading}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-6 text-sm text-muted">
          © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
