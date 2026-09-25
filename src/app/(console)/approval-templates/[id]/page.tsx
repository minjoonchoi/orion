import { getRelatedGroups } from "@/features/relationships/repository";
import { RelatedRecords } from "@/features/relationships/related-records";
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
  const groups = await getRelatedGroups("approval-templates", id);
  return (
    <>
      <TemplateScreen data={data} />
      <RelatedRecords groups={groups} />
    </>
  );
}
