import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { RoleCatalog } from "@/features/platforms/screens";
export default async function Page() {
  return (
    <Suspense>
      <RoleCatalog d={await loadDirectory()} />
    </Suspense>
  );
}
