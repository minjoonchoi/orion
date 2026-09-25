import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ServiceAccountScreen } from "@/features/service-accounts/screens";
import { serviceAccountRepository } from "@/features/service-accounts/repository";
export const metadata = { title: "서비스 어카운트 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await serviceAccountRepository.getAccount(id);
  if (!data) notFound();
  return (
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
      <ServiceAccountScreen data={data} />
    </Suspense>
  );
}
