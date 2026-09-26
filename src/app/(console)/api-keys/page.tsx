import { apiKeyRepository } from "@/features/api-keys/repository";
import { LegacyKeys } from "@/features/approval-workflow/legacy";
import { Suspense } from "react";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { WorkflowList } from "@/features/approval-workflow/screens";
export default async function Page() {
  return (
    <Suspense>
      <WorkflowList
        s={await loadWorkflow()}

        kind="keys"
      />
      <LegacyKeys rows={await apiKeyRepository.listKeys()} />
    </Suspense>
  );
}
