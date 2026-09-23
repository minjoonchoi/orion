import { notFound } from "next/navigation";
import { TemplateScreen } from "@/features/approvals/screens";
import { approvalRepository } from "@/features/approvals/repository";
export const metadata = { title: "결재 템플릿 상세" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await approvalRepository.getTemplate(id);
  if (!data) notFound();
  return <TemplateScreen data={data} />;
}
