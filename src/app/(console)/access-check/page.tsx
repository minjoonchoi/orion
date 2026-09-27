import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { AccessCheck } from "@/features/access-ui/screens";
export default async function Page() {
  const d = await loadDirectory();
  const s = await loadWorkflow();
  return (
    <Suspense>
      <AccessCheck d={d} actorId={s.actorId} />
    </Suspense>
  );
}
