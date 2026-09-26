import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { getRelatedGroups } from "@/features/relationships/repository";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ApiKeyScreen } from "@/features/api-keys/screens";
import { apiKeyRepository } from "@/features/api-keys/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("API 키 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await apiKeyRepository.getKey(id);
  if (!data) notFound();
  const groups = await getRelatedGroups("api-keys", id);
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <ApiKeyScreen data={data} groups={groups} />
    </Suspense>
  );
}
