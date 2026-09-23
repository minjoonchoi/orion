import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
export type { AccountRow, AccountDetail } from "./repository.mock";
type Repository = typeof import("./repository.mock").serviceAccountRepository;
export const serviceAccountRepository: Repository = {
  async listAccounts() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).serviceAccountRepository.listAccounts();
    return listData("service-accounts");
  },
  async getAccount(id: string) {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).serviceAccountRepository.getAccount(id);
    return detailData("service-accounts", id);
  },
};
