import { Suspense } from "react";
import { loadDirectory } from "@/features/platforms/repository";
import { MemberScreen } from "@/features/platforms/screens";
import { notFound } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const d = await loadDirectory();
  if (!d.members.some((m) => m.platformId === id && m.id === memberId))
    notFound();
  return (
    <Suspense>
      <MemberScreen d={d} platformId={id} id={memberId} />
    </Suspense>
  );
}
