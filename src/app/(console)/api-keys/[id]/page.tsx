import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ApiKeyScreen } from "@/features/api-keys/screens";
import { apiKeyRepository } from "@/features/api-keys/repository";
export const metadata = { title: "API 키 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await apiKeyRepository.getKey(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("api-keys", id);
  return (
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
      <ApiKeyScreen data={data} />
      <RelatedRecords groups={groups} />
    </Suspense>
  );
}
