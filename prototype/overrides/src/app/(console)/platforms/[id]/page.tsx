import { ContractDetail } from "@/features/definition-contract/catalog";
import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { PlatformsScreen } from "@/features/platforms/screens";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id } = await params;
  const d = await loadDirectory();
  if (!d.platforms.some((p) => p.id === id))
    return (
      <Suspense>
        <ContractDetail kind="platform" id={id} />
      </Suspense>
    );
  return (
    <Suspense>
      <PlatformsScreen d={d} id={id} />
    </Suspense>
  );
}
