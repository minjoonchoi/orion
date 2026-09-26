import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { notFound } from "next/navigation";
import { ApprovalScreen } from "@/features/approvals/screens";
import { approvalRepository } from "@/features/approvals/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("결재 상세") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await approvalRepository.getApproval(id);
  if (!data) notFound();
  return <ApprovalScreen data={data} />;
}
