import { Suspense } from "react";
import { PolicySyncScreen } from "@/features/policy-sync/screen";

export default function Page() {
  return (
    <Suspense>
      <PolicySyncScreen />
    </Suspense>
  );
}
