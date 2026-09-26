import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import type { Graph } from "./model";
import { serviceAccountRoles } from "../service-accounts/fixtures";
const globalStore = globalThis as typeof globalThis & {
  orionAuthorization?: Map<string, { graph: Graph; updated: number }>;
};
const store: Map<string, { graph: Graph; updated: number }> =
  (globalStore.orionAuthorization ??= new Map<
    string,
    { graph: Graph; updated: number }
  >());
export async function existingGraph(): Promise<Graph | null> {
  const id = (await cookies()).get("orion-demo-access")?.value;
  const entry = id ? store.get(id) : undefined;
  if (entry && Date.now() - entry.updated < 3600000) return entry.graph;
  return null;
}
export async function saveDemoGraph(graph: Graph, expectedRevision?: number) {
  const jar = await cookies();
  let id = jar.get("orion-demo-access")?.value;
  if (
    expectedRevision !== undefined &&
    (!id || store.get(id)?.graph.revision !== expectedRevision)
  )
    throw new Error("CONFLICT");
  if (!id || !store.has(id)) {
    id = randomUUID();
    jar.set("orion-demo-access", id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
      secure: process.env.ORION_ENVIRONMENT === "production",
    });
  }
  if (store.size >= 100) store.delete(store.keys().next().value!);
  store.set(id, { graph, updated: Date.now() });
}
export async function clearDemo() {
  const jar = await cookies();
  const id = jar.get("orion-demo-access")?.value;
  if (id) store.delete(id);
  jar.delete("orion-demo-access");
}
export async function initialGraph(): Promise<Graph> {
  const [identity, access, resource, data] = await Promise.all([
    import("../identity/repository.mock"),
    import("../access/repository.mock"),
    import("../resources/repository.mock"),
    import("../identity/fixtures"),
  ]);
  const [
    users,
    organizations,
    roles,
    policies,
    services,
    endpoints,
    workspaces,
    pages,
  ] = await Promise.all([
    identity.identityRepository.listUsers(),
    identity.identityRepository.listOrganizations(),
    access.accessRepository.listRoles(),
    access.accessRepository.listPolicies(),
    resource.resourceRepository.listServices(),
    resource.resourceRepository.listEndpoints(),
    resource.resourceRepository.listWorkspaces(),
    resource.resourceRepository.listPages(),
  ]);
  const details = await Promise.all(
    roles.map((r) => access.accessRepository.getRole(r.id)),
  );
  return {
    revision: 0,
    users: users.map(({ id, name }) => ({ id, name })),
    serviceAccounts: data.serviceAccounts.map(
      ({ id, name, organizationId }) => ({
        id,
        name,
        organizationId,
        roleIds: serviceAccountRoles[id] ?? [],
      }),
    ),
    organizations: organizations.map(({ id, name }) => ({
      id,
      name,
      memberIds: data.memberships
        .filter((m) => m.organizationId === id)
        .map((m) => m.userId),
    })),
    roles: roles.map((r, i) => ({
      ...r,
      userIds: details[i]!.users.map((u) => u.id),
      organizationIds: details[i]!.organizations.map((o) => o.id),
      bindings: details[i]!.policies.map((p) => ({
        policyId: p.id,
        expiresAt: null,
      })),
    })),
    policies: policies.map((p) => ({
      ...p,
      effect: "allow",
      resources: [
        ...p.serviceIds.map((id) => ({ kind: "services" as const, id })),
        ...p.endpointIds.map((id) => ({
          kind: "service-endpoints" as const,
          id,
        })),
        ...p.workspaceIds.map((id) => ({ kind: "workspaces" as const, id })),
      ],
    })),
    resources: [
      ...services.map((r) => ({
        ...r,
        kind: "services" as const,
        parentId: "",
        path: "",
        method: "",
      })),
      ...endpoints.map((r) => ({
        ...r,
        kind: "service-endpoints" as const,
        parentId: r.serviceId,
        description: "",
      })),
      ...workspaces.map((r) => ({
        ...r,
        kind: "workspaces" as const,
        parentId: "",
        path: "",
        method: "",
      })),
      ...pages.map((r) => ({
        ...r,
        kind: "pages" as const,
        method: "",
        parentId: r.workspaceId,
      })),
    ],
  };
}
