import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { PlatformsScreen } from "@/features/platforms/screens";
export default async function Page() {
  const d = await loadDirectory();
  return (
    <Suspense>
      <PlatformsScreen d={d} />
    </Suspense>
  );
}
