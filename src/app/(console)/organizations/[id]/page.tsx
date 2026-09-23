import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OrganizationScreen } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("조직 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await identityRepository.getOrganization(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("organizations", id);
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <OrganizationScreen data={data} />
      <RelatedRecords groups={groups} />
    </Suspense>
  );
}
