import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ServiceAccountScreen } from "@/features/service-accounts/screens";
import { serviceAccountRepository } from "@/features/service-accounts/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("서비스 어카운트 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await serviceAccountRepository.getAccount(id);
  if (!data) notFound();
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <ServiceAccountScreen data={data} />
    </Suspense>
  );
}
