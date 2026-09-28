import { ContractCatalog } from "@/features/definition-contract/catalog";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default function Page() {
  return (
    <>
      <ContractCatalog kind="domain" />
      <Suspense>
        <DefinitionsScreen kind="domains" />
      </Suspense>
    </>
  );
}
