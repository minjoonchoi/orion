import { Suspense } from "react";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { WorkflowList } from "@/features/approval-workflow/screens";
import { deployment } from "@/lib/api/server";
export default async function Page() {
  return (
    <Suspense>
      <WorkflowList
        s={await loadWorkflow()}
        demo={deployment().mode === "demo"}
        kind="templates"
      />
    </Suspense>
  );
}
