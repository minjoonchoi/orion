import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageScreen } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("페이지 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await resourceRepository.getPage(id);
  if (!data) notFound();
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <PageScreen data={data} />
    </Suspense>
  );
}
