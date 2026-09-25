import "server-only";
import { services as originalServices } from "../identity/fixtures";
import { existingGraph } from "../authorization/demo";
import type {
  ServiceRow,
  EndpointRow,
  WorkspaceRow,
  PageRow,
  Endpoint,
} from "../resources/types";
export async function demoCatalog() {
  const graph = await existingGraph();
  if (!graph) return null;
  const services: ServiceRow[] = graph.resources
    .filter((r) => r.kind === "services")
    .map((r) => ({
      ...r,
      status: originalServices.find((s) => s.id === r.id)?.status ?? "active",
      endpointCount: graph.resources.filter(
        (e) => e.kind === "service-endpoints" && e.parentId === r.id,
      ).length,
    }));
  const endpoints: EndpointRow[] = graph.resources
    .filter((r) => r.kind === "service-endpoints")
    .map((r) => ({
      ...r,
      method: r.method as Endpoint["method"],
      serviceId: r.parentId ?? "",
      serviceName:
        services.find((s) => s.id === r.parentId)?.name ?? r.parentId ?? "",
    }));
  const workspaces: WorkspaceRow[] = graph.resources
    .filter((r) => r.kind === "workspaces")
    .map((r) => ({
      ...r,
      pageCount: graph.resources.filter(
        (e) => e.kind === "pages" && e.parentId === r.id,
      ).length,
    }));
  const pages: PageRow[] = graph.resources
    .filter((r) => r.kind === "pages")
    .map((r) => ({
      ...r,
      workspaceId: r.parentId ?? "",
      workspaceName:
        workspaces.find((s) => s.id === r.parentId)?.name ?? r.parentId ?? "",
    }));
  return { services, endpoints, workspaces, pages };
}
