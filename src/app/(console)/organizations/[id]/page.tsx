import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { OrganizationScreen } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export const metadata = { title: "조직 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await identityRepository.getOrganization(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("organizations", id);
  return (
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
      <OrganizationScreen data={data} />
      <RelatedRecords groups={groups} />
    </Suspense>
  );
}
