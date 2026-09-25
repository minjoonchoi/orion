import { ApprovalsList } from "@/features/approvals/screens";
import { approvalRepository } from "@/features/approvals/repository";
export const metadata = { title: "결재" };
export default async function Page() {
  return <ApprovalsList rows={await approvalRepository.listApprovals()} />;
}
