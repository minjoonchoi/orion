import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
type Repository = typeof import("./repository.mock").identityRepository;
export const identityRepository: Repository = {
  async listUsers() {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).identityRepository.listUsers();
    return listData("users");
  },
  async listOrganizations() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).identityRepository.listOrganizations();
    return listData("organizations");
  },
  async getUser(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).identityRepository.getUser(id);
    return detailData("users", id);
  },
  async getOrganization(id: string) {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).identityRepository.getOrganization(id);
    return detailData("organizations", id);
  },
};
