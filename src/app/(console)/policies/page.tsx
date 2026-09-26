import { loadWorkflow } from "@/features/approval-workflow/server";
import { ManagedGrants } from "@/features/approval-workflow/screens";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page() {
  return (
    <Suspense>
      <DefinitionsScreen kind="policies" />
      <ManagedGrants s={await loadWorkflow()} kind="policies" />
    </Suspense>
  );
}
