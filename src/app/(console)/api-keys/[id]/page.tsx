import { getRelatedGroups } from "@/features/relationships/repository";
import { apiKeyRepository } from "@/features/api-keys/repository";
import { ApiKeyScreen } from "@/features/api-keys/screens";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadWorkflow } from "@/features/approval-workflow/server";
import { KeyScreen } from "@/features/approval-workflow/screens";
import { deployment } from "@/lib/api/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await loadWorkflow();
  const item = s.keys.find((v) => v.id === id);
  if (!item) {
    const legacy = await apiKeyRepository.getKey(id);
    if (!legacy) notFound();
    return (
      <Suspense>
        <ApiKeyScreen
          data={{ ...legacy, approvals: [] }}
          groups={(await getRelatedGroups("api-keys", id)).filter(
            (g) => g.title === "서비스 어카운트",
          )}
        />
      </Suspense>
    );
  }
  return (
    <Suspense>
      <KeyScreen s={s} k={item} demo={deployment().mode === "demo"} />
    </Suspense>
  );
}
