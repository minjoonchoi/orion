import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { ScopedRoleScreen } from "@/features/platforms/screens";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id } = await params;
  const d = await loadDirectory();
  if (!d.roles.some((r) => r.id === id)) notFound();
  return (
    <Suspense>
      <ScopedRoleScreen d={d} id={id} />
    </Suspense>
  );
}
