import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
export type {
  Policy,
  RoleRow,
  PolicyRow,
  RoleDetail,
  PolicyDetail,
} from "./repository.mock";
type Repository = typeof import("./repository.mock").accessRepository;
export const accessRepository: Repository = {
  async listRoles() {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).accessRepository.listRoles();
    return listData("roles");
  },
  async listPolicies() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).accessRepository.listPolicies();
    return listData("policies");
  },
  async getRole(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).accessRepository.getRole(id);
    return detailData("roles", id);
  },
  async getPolicy(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).accessRepository.getPolicy(id);
    return detailData("policies", id);
  },
};
