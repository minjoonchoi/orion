import { Suspense } from "react";
import { ResourceSyncScreen } from "@/features/resource-sync/screen";
export default function Page() {
  return (
    <Suspense>
      <ResourceSyncScreen />
    </Suspense>
  );
}
