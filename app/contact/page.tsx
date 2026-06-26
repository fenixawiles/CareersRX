import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the CareersRX team.",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader title="Contact us" subtitle="We'd love to hear from you." />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_280px]">
          {/* Form (wired to the contact API in a later phase) */}
          <form className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" />
              <Field label="Email" name="email" type="email" />
            </div>
            <Field label="Subject" name="subject" />
            <div>
              <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus-visible:border-primary"
              />
            </div>
            <Button type="submit" size="md">
              Send Message
            </Button>
          </form>

          <aside className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Mail size={18} className="mt-0.5 text-primary" />
              <div>
                <div className="font-medium text-foreground">Email</div>
                <div className="text-muted">hello@suncurejobs.com</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 text-primary" />
              <div>
                <div className="font-medium text-foreground">Serving</div>
                <div className="text-muted">The southern US, Florida to California</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
}: {
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus-visible:border-primary"
      />
    </div>
  );
}
