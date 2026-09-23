import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
type Repository = typeof import("./repository.mock").approvalRepository;
export const approvalRepository: Repository = {
  async listTemplates() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).approvalRepository.listTemplates();
    return listData("approval-templates");
  },
  async listApprovals() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).approvalRepository.listApprovals();
    return listData("approvals");
  },
  async getTemplate(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).approvalRepository.getTemplate(
        id,
      );
    return detailData("approval-templates", id);
  },
  async getApproval(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).approvalRepository.getApproval(
        id,
      );
    return detailData("approvals", id);
  },
};
