import { DashboardHeading } from "@/components/dashboard/DashboardUI";
import { PostJobWizard } from "@/components/forms/PostJobWizard";

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <DashboardHeading
        title="Post a job"
        description="Reach candidates in the first CareersRX healthcare and senior care vertical."
      />
      <PostJobWizard />
    </div>
  );
}
