import { AuthorizationPanel } from "@/features/authorization/panel";
import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EndpointScreen } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("서비스 엔드포인트 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await resourceRepository.getEndpoint(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("service-endpoints", id);
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <EndpointScreen data={data} />
      <AuthorizationPanel kind="service-endpoints" id={id} />
      <RelatedRecords groups={groups} />
    </Suspense>
  );
}
