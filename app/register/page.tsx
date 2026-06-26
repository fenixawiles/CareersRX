import type { Metadata } from "next";
import Link from "next/link";
import { User, Building2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

export const metadata: Metadata = {
  title: "Create an Account",
  description: "Join CareersRX as a job seeker or an employer.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 sm:px-6">
      <Logo />
      <h1 className="mt-8 text-center text-3xl font-bold text-foreground">
        How do you want to get started?
      </h1>
      <p className="mt-2 text-center text-muted">Choose the account that fits you.</p>

      <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
        <RoleCard
          href="/register/seeker"
          icon={User}
          title="I'm looking for work"
          body="Find roles, save jobs, and apply with one connected profile."
        />
        <RoleCard
          href="/register/employer"
          icon={Building2}
          title="I'm hiring"
          body="Post jobs, review applicants, and manage your hiring team."
        />
      </div>

      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function RoleCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
        <Icon size={24} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        Continue <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
