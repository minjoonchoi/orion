import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RoleScreen } from "@/features/access/screens";
import { accessRepository } from "@/features/access/repository";
export const metadata = { title: "역할 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await accessRepository.getRole(id);
  if (!data) notFound();
  return (
    <Suspense fallback={<p role="status">불러오는 중…</p>}>
      <RoleScreen data={data} />
    </Suspense>
  );
}
