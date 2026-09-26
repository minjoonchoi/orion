import "server-only";
import { existingGraph } from "./demo";
/** Session-scoped demo edits also feed the existing read screens. */
export async function projectDemo<T>(method: string, value: T): Promise<T> {
  const graph = await existingGraph();
  if (!graph || value === null) return value;
  const identity = await import("../identity/fixtures");
  const active = (expiresAt: string | null) =>
    !expiresAt || Date.parse(expiresAt) > Date.now();
  const roles = graph.roles.map((r) => ({
    ...r,
    userCount: r.userIds.length,
    organizationCount: r.organizationIds.length,
    policyCount: r.bindings.filter((b) => active(b.expiresAt)).length,
  }));
  const policies = graph.policies.map((p) => ({
    ...p,
    serviceIds: p.resources
      .filter((r) => r.kind === "services")
      .map((r) => r.id),
    endpointIds: p.resources
      .filter((r) => r.kind === "service-endpoints")
      .map((r) => r.id),
    workspaceIds: p.resources
      .filter((r) => r.kind === "workspaces")
      .map((r) => r.id),
    pageIds: p.resources.filter((r) => r.kind === "pages").map((r) => r.id),
    serviceCount: p.resources.filter((r) => r.kind === "services").length,
    endpointCount: p.resources.filter((r) => r.kind === "service-endpoints")
      .length,
    workspaceCount: p.resources.filter((r) => r.kind === "workspaces").length,
  }));
  const patchResource = (kind: string, item: Record<string, unknown>) => ({
    ...item,
    ...graph.resources.find((r) => r.kind === kind && r.id === item.id),
  });
  let result: unknown = value;
  const record = value as Record<string, unknown>;
  switch (method) {
    case "listRoles":
      result = roles;
      break;
    case "listPolicies":
      result = policies;
      break;
    case "listUsers":
      result = (value as Record<string, unknown>[]).map((u) => ({
        ...u,
        roleCount: roles.filter((r) => r.userIds.includes(String(u.id))).length,
      }));
      break;
    case "getUser": {
      const user = record.user as { id: string };
      result = {
        ...record,
        roles: roles.filter((r) => r.userIds.includes(user.id)),
      };
      break;
    }
    case "listOrganizations":
      result = (value as Record<string, unknown>[]).map((o) => ({
        ...o,
        roleCount: roles.filter((r) => r.organizationIds.includes(String(o.id)))
          .length,
      }));
      break;
    case "getOrganization": {
      const org = record.organization as { id: string };
      const linked = roles.filter((r) => r.organizationIds.includes(org.id));
      result = {
        ...record,
        organization: { ...org, roleCount: linked.length },
        roles: linked,
        services: (record.services as Record<string, unknown>[]).map((r) =>
          patchResource("services", r),
        ),
      };
      break;
    }
    case "getRole": {
      const id = (record.role as { id: string }).id;
      const role = roles.find((r) => r.id === id)!;
      result = {
        role,
        users: identity.users.filter((u) => role.userIds.includes(u.id)),
        organizations: identity.organizations.filter((o) =>
          role.organizationIds.includes(o.id),
        ),
        policies: policies.filter((p) =>
          role.bindings.some((b) => b.policyId === p.id && active(b.expiresAt)),
        ),
      };
      break;
    }
    case "getPolicy": {
      const id = (record.policy as { id: string }).id;
      const policy = policies.find((p) => p.id === id)!;
      const catalog = await (
        await import("../resource-sync/demo-catalog")
      ).demoCatalog();
      if (catalog)
        result = {
          policy,
          services: catalog.services.filter((r) =>
            policy.serviceIds.includes(r.id),
          ),
          endpoints: catalog.endpoints.filter((r) =>
            policy.endpointIds.includes(r.id),
          ),
          pages: catalog.pages.filter((r) => policy.pageIds.includes(r.id)),
          workspaces: catalog.workspaces.filter((r) =>
            policy.workspaceIds.includes(r.id),
          ),
        };
      break;
    }
    case "listServices":
    case "listEndpoints":
    case "listWorkspaces":
    case "listPages": {
      const kind = {
        listServices: "services",
        listEndpoints: "service-endpoints",
        listWorkspaces: "workspaces",
        listPages: "pages",
      }[method];
      result = (value as Record<string, unknown>[]).map((r) =>
        patchResource(kind, r),
      );
      break;
    }
    case "getEndpoint":
      result = patchResource("service-endpoints", record);
      break;
    case "getPage":
      result = patchResource("pages", record);
      break;
    case "getService":
      result = {
        ...record,
        service: patchResource(
          "services",
          record.service as Record<string, unknown>,
        ),
        endpoints: (record.endpoints as Record<string, unknown>[]).map((r) =>
          patchResource("service-endpoints", r),
        ),
      };
      break;
    case "getWorkspace":
      result = {
        ...record,
        workspace: patchResource(
          "workspaces",
          record.workspace as Record<string, unknown>,
        ),
        pages: (record.pages as Record<string, unknown>[]).map((r) =>
          patchResource("pages", r),
        ),
      };
      break;
  }
  return result as T;
}
