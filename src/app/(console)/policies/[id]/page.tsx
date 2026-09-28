import { ContractDetail } from "@/features/definition-contract/catalog";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { ManagedGrantScreen } from "@/features/approval-workflow/screens";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workflow = await loadWorkflow();
  const managed = workflow.keys.find(
    (k) => k.policyId === id && k.status === "active",
  );
  if (managed)
    return (
      <Suspense>
        <ManagedGrantScreen s={workflow} k={managed} kind="policies" />
      </Suspense>
    );
  return (
    <Suspense>
      <ContractDetail kind="policy" id={id}>
        <DefinitionsScreen kind="policies" id={id} />
      </ContractDetail>
    </Suspense>
  );
}
