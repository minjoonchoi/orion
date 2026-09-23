import { services } from "../identity/fixtures";
import { endpoints, workspaces, pages } from "./fixtures";
import type {
  ServiceRow,
  EndpointRow,
  WorkspaceRow,
  PageRow,
  ServiceDetail,
  WorkspaceDetail,
} from "./types";
const serviceRows = (): ServiceRow[] =>
  services.map((s) => ({
    ...s,
    endpointCount: endpoints.filter((e) => e.serviceId === s.id).length,
  }));
const endpointRows = (): EndpointRow[] =>
  endpoints.map((e) => ({
    ...e,
    serviceName: services.find((s) => s.id === e.serviceId)!.name,
  }));
const workspaceRows = (): WorkspaceRow[] =>
  workspaces.map((w) => ({
    ...w,
    pageCount: pages.filter((p) => p.workspaceId === w.id).length,
  }));
const pageRows = (): PageRow[] =>
  pages.map((p) => ({
    ...p,
    workspaceName: workspaces.find((w) => w.id === p.workspaceId)!.name,
  }));
// Replace this read-only adapter with validated API responses when contracts are available.
export const resourceRepository = {
  async listServices() {
    return serviceRows();
  },
  async listEndpoints() {
    return endpointRows();
  },
  async listWorkspaces() {
    return workspaceRows();
  },
  async listPages() {
    return pageRows();
  },
  async getService(id: string): Promise<ServiceDetail | null> {
    const service = serviceRows().find((s) => s.id === id);
    return service
      ? { service, endpoints: endpointRows().filter((e) => e.serviceId === id) }
      : null;
  },
  async getEndpoint(id: string): Promise<EndpointRow | null> {
    return endpointRows().find((e) => e.id === id) ?? null;
  },
  async getWorkspace(id: string): Promise<WorkspaceDetail | null> {
    const workspace = workspaceRows().find((w) => w.id === id);
    return workspace
      ? { workspace, pages: pageRows().filter((p) => p.workspaceId === id) }
      : null;
  },
  async getPage(id: string): Promise<PageRow | null> {
    return pageRows().find((p) => p.id === id) ?? null;
  },
};
