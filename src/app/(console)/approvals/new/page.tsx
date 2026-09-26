import { Suspense } from "react";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { RequestScreen } from "@/features/approval-workflow/screens";
export default async function Page() {
  return (
    <Suspense>
      <RequestScreen s={await loadWorkflow()} />
    </Suspense>
  );
}
