import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EndpointScreen } from "@/features/resources/screens";
import { resourceRepository } from "@/features/resources/repository";
export const metadata = { title: "서비스 엔드포인트 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await resourceRepository.getEndpoint(id);
  if (!data) notFound();
  return (
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
      <EndpointScreen data={data} />
    </Suspense>
  );
}
