import { TemplatesList } from "@/features/approvals/screens";
import { approvalRepository } from "@/features/approvals/repository";
export const metadata = { title: "결재 템플릿" };
export default async function Page() {
  return <TemplatesList rows={await approvalRepository.listTemplates()} />;
}
