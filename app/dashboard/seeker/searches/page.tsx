import { Search } from "lucide-react";
import { DashboardHeading, EmptyState } from "@/components/dashboard/DashboardUI";
import { Button } from "@/components/ui/Button";

export default function SeekerSearchesPage() {
  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Saved searches"
        description="Save a search to quickly return to it later."
      />

      {/* Email alerts are gated behind FEATURES.SAVED_SEARCH_ALERTS (deferred). */}
      <EmptyState
        icon={Search}
        title="No saved searches"
        description="Run a search and save it to find matching roles faster."
        action={
          <Button href="/jobs" size="sm">
            Start a Search
          </Button>
        }
      />
    </div>
  );
}
