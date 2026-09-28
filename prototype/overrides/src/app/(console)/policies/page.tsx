import { deployment } from "@/lib/api/server";
import { PolicyList } from "@/features/definition-contract/policy-ui";
import { Suspense } from "react";
import { DefinitionsScreen } from "@/features/definitions/screen";
export default async function Page() {
  if (deployment().mode === "api")
    return (
      <Suspense>
        <DefinitionsScreen kind="policies" />
      </Suspense>
    );
  return (
    <Suspense>
      <div className="ui-layout-stack">
        <PolicyList />
        <details>
          <summary>기존 정책 · 이관 대상</summary>
          <div className="ui-disclosure-body ui-layout-stack">
            <DefinitionsScreen kind="policies" />
          </div>
        </details>
      </div>
    </Suspense>
  );
}
