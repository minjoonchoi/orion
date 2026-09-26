import { demoCatalog } from "../resource-sync/demo-catalog";
import { projectDemo } from "@/features/authorization/project-demo";
import "server-only";
import { deployment, listData, detailData } from "@/lib/api/server";
type Repository = typeof import("./repository.mock").resourceRepository;
export const resourceRepository: Repository = {
  async listServices() {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) return c.services;
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "listServices",
        await (
          await import("./repository.mock")
        ).resourceRepository.listServices(),
      );
    return listData("services");
  },
  async listEndpoints() {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) return c.endpoints;
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "listEndpoints",
        await (
          await import("./repository.mock")
        ).resourceRepository.listEndpoints(),
      );
    return listData("service-endpoints");
  },
  async listWorkspaces() {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) return c.workspaces;
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "listWorkspaces",
        await (
          await import("./repository.mock")
        ).resourceRepository.listWorkspaces(),
      );
    return listData("workspaces");
  },
  async listPages() {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) return c.pages;
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "listPages",
        await (
          await import("./repository.mock")
        ).resourceRepository.listPages(),
      );
    return listData("pages");
  },
  async getService(id: string) {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) {
        const item = c.services.find((r) => r.id === id);
        return item
          ? {
              service: item,
              endpoints: c.endpoints.filter((e) => e.serviceId === id),
            }
          : null;
      }
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "getService",
        await (
          await import("./repository.mock")
        ).resourceRepository.getService(id),
      );
    return detailData("services", id);
  },
  async getEndpoint(id: string) {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) {
        const item = c.endpoints.find((r) => r.id === id);
        return item ? item : null;
      }
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "getEndpoint",
        await (
          await import("./repository.mock")
        ).resourceRepository.getEndpoint(id),
      );
    return detailData("service-endpoints", id);
  },
  async getWorkspace(id: string) {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) {
        const item = c.workspaces.find((r) => r.id === id);
        return item
          ? {
              workspace: item,
              pages: c.pages.filter((p) => p.workspaceId === id),
            }
          : null;
      }
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "getWorkspace",
        await (
          await import("./repository.mock")
        ).resourceRepository.getWorkspace(id),
      );
    return detailData("workspaces", id);
  },
  async getPage(id: string) {
    if (deployment().mode === "demo") {
      const c = await demoCatalog();
      if (c) {
        const item = c.pages.find((r) => r.id === id);
        return item ? item : null;
      }
    }
    if (deployment().mode === "demo")
      return projectDemo(
        "getPage",
        await (
          await import("./repository.mock")
        ).resourceRepository.getPage(id),
      );
    return detailData("pages", id);
  },
};
