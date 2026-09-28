import { ContractDetail } from "@/features/definition-contract/catalog";
import { loadDirectory } from "@/features/platforms/repository";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <ContractDetail kind="workspace" id={id}>
        <DefinitionsScreen
          directory={await loadDirectory()}
          kind="workspaces"
          id={id}
        />
      </ContractDetail>
    </Suspense>
  );
}
