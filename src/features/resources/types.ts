import type { ManagedService } from "../identity/types";
export type Endpoint = {
  id: string;
  name: string;
  serviceId: string;
  method: "GET" | "POST";
  path: string;
};
export type Workspace = { id: string; name: string; description: string };
export type ResourcePage = {
  id: string;
  name: string;
  description: string;
  workspaceId: string;
  path: string;
};
export type ServiceRow = ManagedService & { endpointCount: number };
export type EndpointRow = Endpoint & { serviceName: string };
export type WorkspaceRow = Workspace & { pageCount: number };
export type PageRow = ResourcePage & { workspaceName: string };
export type ServiceDetail = { service: ServiceRow; endpoints: EndpointRow[] };
export type WorkspaceDetail = { workspace: WorkspaceRow; pages: PageRow[] };
