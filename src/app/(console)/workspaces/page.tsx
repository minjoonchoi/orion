import { ContractCatalog } from "@/features/definition-contract/catalog";
import { loadDirectory } from "@/features/platforms/repository";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page() {
  return (
    <>
      <ContractCatalog kind="workspace" />
      <Suspense>
        <DefinitionsScreen
          directory={await loadDirectory()}
          kind="workspaces"
        />
      </Suspense>
    </>
  );
}
