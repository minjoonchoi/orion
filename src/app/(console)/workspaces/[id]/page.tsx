import { AuthorizationPanel } from "@/features/authorization/panel";
import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkspaceScreen } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("워크스페이스 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await resourceRepository.getWorkspace(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("workspaces", id);
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <WorkspaceScreen data={data} />
      <AuthorizationPanel kind="workspaces" id={id} />
      <RelatedRecords groups={groups} />
    </Suspense>
  );
}
