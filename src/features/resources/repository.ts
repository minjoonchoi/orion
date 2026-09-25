import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
type Repository = typeof import("./repository.mock").resourceRepository;
export const resourceRepository: Repository = {
  async listServices() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).resourceRepository.listServices();
    return listData("services");
  },
  async listEndpoints() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).resourceRepository.listEndpoints();
    return listData("service-endpoints");
  },
  async listWorkspaces() {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).resourceRepository.listWorkspaces();
    return listData("workspaces");
  },
  async listPages() {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).resourceRepository.listPages();
    return listData("pages");
  },
  async getService(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).resourceRepository.getService(
        id,
      );
    return detailData("services", id);
  },
  async getEndpoint(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).resourceRepository.getEndpoint(
        id,
      );
    return detailData("service-endpoints", id);
  },
  async getWorkspace(id: string) {
    if (deployment().mode === "demo")
      return (
        await import("./repository.mock")
      ).resourceRepository.getWorkspace(id);
    return detailData("workspaces", id);
  },
  async getPage(id: string) {
    if (deployment().mode === "demo")
      return (await import("./repository.mock")).resourceRepository.getPage(id);
    return detailData("pages", id);
  },
};
