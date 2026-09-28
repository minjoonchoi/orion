import { ContractCatalog } from "@/features/definition-contract/catalog";
import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { PlatformsScreen } from "@/features/platforms/screens";
export default async function Page() {
  const d = await loadDirectory();
  return (
    <Suspense>
      <ContractCatalog kind="platform" />
      <PlatformsScreen d={d} />
    </Suspense>
  );
}
