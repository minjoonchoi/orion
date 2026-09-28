import { ContractCatalog } from "@/features/definition-contract/catalog";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default function Page() {
  return (
    <>
      <ContractCatalog kind="service" />
      <Suspense>
        <DefinitionsScreen kind="services" />
      </Suspense>
    </>
  );
}
