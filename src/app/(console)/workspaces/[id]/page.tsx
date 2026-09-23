import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkspaceScreen } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export const metadata = { title: "워크스페이스 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await resourceRepository.getWorkspace(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("workspaces", id);
  return (
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
      <WorkspaceScreen data={data} />
      <RelatedRecords groups={groups} />
    </Suspense>
  );
}
