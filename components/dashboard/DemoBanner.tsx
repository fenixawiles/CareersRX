import { Info } from "lucide-react";

/** Small banner reminding viewers this is a demo with no live backend yet. */
export function DemoBanner({ role }: { role: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-accent-light bg-accent-light/50 px-4 py-3 text-sm text-accent-dark">
      <Info size={16} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">Demo preview</span> — you’re viewing the {role}{" "}
        experience with sample data. Account sign-in and saving are coming in the next build
        phase.
      </p>
    </div>
  );
}
