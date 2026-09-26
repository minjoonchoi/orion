import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { PlatformsScreen } from "@/features/platforms/screens";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id } = await params;
  const d = await loadDirectory();
  if (!d.platforms.some((p) => p.id === id)) notFound();
  return (
    <Suspense>
      <PlatformsScreen d={d} id={id} />
    </Suspense>
  );
}
