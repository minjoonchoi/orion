import { PolicyAccessCheck } from "@/features/definition-contract/policy-ui";
import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { AccessCheck } from "@/features/access-ui/screens";
export default async function Page() {
  const d = await loadDirectory();
  const s = await loadWorkflow();
  return (
    <Suspense>
      <PolicyAccessCheck />
      <details>
        <summary>기존 사용자 접근 확인</summary>
        <div className="ui-disclosure-body ui-layout-stack">
          <AccessCheck d={d} actorId={s.actorId} />
        </div>
      </details>
    </Suspense>
  );
}
