import type { Metadata } from "next";
import { Check, Users, ShieldCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "For Employers",
  description:
    "Reach qualified healthcare and senior care candidates in the first CareersRX hiring vertical.",
};

export default function EmployersPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-primary-light to-background">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Hire qualified people in your care vertical
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            CareersRX starts with healthcare and senior care, connecting communities with
            caregivers, nurses, and support staff who genuinely want to do this work.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/register/employer" size="lg">
              Post a Job Free
            </Button>
            <Button href="/contact" variant="outline" size="lg">
              Talk to Us
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Targeted candidates",
              body: "This first vertical is focused on healthcare and senior care, so early employers get a more relevant candidate pool.",
            },
            {
              icon: ShieldCheck,
              title: "Verified & trusted",
              body: "A verified-employer badge and our safety standards build candidate confidence in your postings.",
            },
            {
              icon: BarChart3,
              title: "Simple applicant tracking",
              body: "Review applicants, track status, and manage your whole hiring team in one place.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <f.icon size={24} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h2>
              <p className="mt-2 text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
            Start free, upgrade when you grow
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-6">
              <h3 className="text-lg font-semibold text-foreground">Free</h3>
              <p className="mt-1 text-3xl font-bold text-foreground">
                $0<span className="text-base font-normal text-muted">/job</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Post up to 5 active jobs", "Applicant tracking", "Verified employer badge"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check size={16} className="text-success" /> {item}
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-6">
                <Button href="/register/employer" variant="outline" size="md" className="w-full">
                  Get Started
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border-2 border-primary bg-background p-6">
              <h3 className="text-lg font-semibold text-primary">Featured</h3>
              <p className="mt-1 text-3xl font-bold text-foreground">
                Contact<span className="text-base font-normal text-muted"> us</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Unlimited active jobs",
                  "Featured placement in search",
                  "Team member accounts",
                  "Priority support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check size={16} className="text-success" /> {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button href="/contact" size="md" className="w-full">
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
