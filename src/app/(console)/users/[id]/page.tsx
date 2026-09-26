import { loadDirectory } from "@/features/platforms/repository";
import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UserScreen } from "@/features/identity/screens";
import { identityRepository } from "@/features/identity/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("사용자 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const data = await identityRepository.getUser(id);
  if (!data) notFound();
  return (
    <Suspense fallback={<p role="status">{t("불러오는 중…")}</p>}>
      <UserScreen data={data} directory={await loadDirectory()} />
    </Suspense>
  );
}
