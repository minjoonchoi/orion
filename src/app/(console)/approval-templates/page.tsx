import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { TemplatesList } from "@/features/approvals/screens";
import { approvalRepository } from "@/features/approvals/repository";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("결재 템플릿") };
}
export default async function Page() {
  return <TemplatesList rows={await approvalRepository.listTemplates()} />;
}
