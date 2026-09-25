import {
  optional,
  array,
  object,
  string,
  number,
  nullable,
  enumeration,
  datetime,
} from "../../lib/api/schema.ts";
export const resourceKinds = [
  "workspaces",
  "pages",
  "services",
  "service-endpoints",
] as const;
export type ResourceKind = (typeof resourceKinds)[number];
export type FocusKind =
  ResourceKind | "users" | "organizations" | "roles" | "policies";
const reference = object({ kind: enumeration(resourceKinds), id: string });
const binding = object({ policyId: string, expiresAt: nullable(datetime) });
export const graphSchema = object({
  revision: number,
  users: array(object({ id: string, name: string })),
  organizations: array(
    object({ id: string, name: string, memberIds: array(string) }),
  ),
  roles: array(
    object({
      id: string,
      name: string,
      description: string,
      userIds: array(string),
      organizationIds: array(string),
      bindings: array(binding),
    }),
  ),
  policies: array(
    object({
      id: string,
      name: string,
      description: string,
      effect: enumeration(["allow", "deny"]),
      resources: array(reference),
    }),
  ),
  resources: array(
    object({
      id: string,
      kind: enumeration(resourceKinds),
      name: string,
      description: string,
      path: string,
      method: string,
      parentId: optional(string),
    }),
  ),
});
export type Graph = ReturnType<typeof graphSchema.parse>;
export type ResourceRef = { kind: ResourceKind; id: string; name?: string };
export function impactForResources(
  graph: Graph,
  refs: ResourceRef[],
  includeExpired = false,
  now = Date.now(),
) {
  const resources = [
    ...new Map(refs.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values(),
  ];
  const entries = resources.map((resource) => ({
    resource,
    paths: impact(graph, resource.kind, resource.id, includeExpired, now),
  }));
  const paths = entries.flatMap((entry) => entry.paths);
  const roles = paths.flatMap((path) => path.roles);
  return {
    entries,
    counts: {
      resources: resources.length,
      policies: new Set(paths.map((path) => path.policy.id)).size,
      roles: new Set(roles.map((role) => role.role.id)).size,
      organizations: new Set(
        roles.flatMap((role) => role.organizations.map((org) => org.id)),
      ).size,
      users: new Set(
        roles.flatMap((role) => [
          ...role.users.map((user) => user.id),
          ...role.organizations.flatMap((org) =>
            org.members.map((user) => user.id),
          ),
        ]),
      ).size,
    },
  };
}
export type Change =
  | {
      type: "subjectRoles";
      subjectKind: "users" | "organizations";
      id: string;
      roleIds: string[];
    }
  | {
      type: "grants";
      roleId: string;
      userIds: string[];
      organizationIds: string[];
    }
  | {
      type: "bindings";
      roleId: string;
      bindings: { policyId: string; expiresAt: string | null }[];
    }
  | {
      type: "policy";
      policyId: string;
      effect: "allow" | "deny";
      resources: { kind: ResourceKind; id: string }[];
    }
  | {
      type: "resource";
      kind: ResourceKind;
      id: string;
      name: string;
      description: string;
      path: string;
      method: string;
    };
export function parseChange(input: unknown): Change {
  const type = object({ type: string }).parse(input).type;
  switch (type) {
    case "subjectRoles":
      return {
        type,
        ...object({
          subjectKind: enumeration(["users", "organizations"]),
          id: string,
          roleIds: array(string),
        }).parse(input),
      };
    case "grants":
      return {
        type,
        ...object({
          roleId: string,
          userIds: array(string),
          organizationIds: array(string),
        }).parse(input),
      };
    case "bindings":
      return {
        type,
        ...object({ roleId: string, bindings: array(binding) }).parse(input),
      };
    case "policy":
      return {
        type,
        ...object({
          policyId: string,
          effect: enumeration(["allow", "deny"]),
          resources: array(reference),
        }).parse(input),
      };
    case "resource":
      return {
        type,
        ...object({
          kind: enumeration(resourceKinds),
          id: string,
          name: string,
          description: string,
          path: string,
          method: string,
        }).parse(input),
      };
    default:
      throw Error("INVALID_CHANGE");
  }
}
function contains(ids: string[], items: { id: string }[]) {
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !items.some((item) => item.id === id))
  )
    throw Error("INVALID_REFERENCE");
}
export function applyChange(
  current: Graph,
  change: Change,
  now = Date.now(),
): Graph {
  const graph = structuredClone(current);
  const role =
    "roleId" in change ? graph.roles.find((r) => r.id === change.roleId) : null;
  if ("roleId" in change && !role) throw Error("INVALID_REFERENCE");
  switch (change.type) {
    case "subjectRoles": {
      contains([change.id], graph[change.subjectKind]);
      contains(change.roleIds, graph.roles);
      const field =
        change.subjectKind === "users" ? "userIds" : "organizationIds";
      graph.roles.forEach((r) => {
        r[field] = r[field].filter((id) => id !== change.id);
        if (change.roleIds.includes(r.id)) r[field].push(change.id);
      });
      break;
    }
    case "grants":
      contains(change.userIds, graph.users);
      contains(change.organizationIds, graph.organizations);
      role!.userIds = change.userIds;
      role!.organizationIds = change.organizationIds;
      break;
    case "bindings": {
      contains(
        change.bindings.map((b) => b.policyId),
        graph.policies,
      );
      for (const b of change.bindings) {
        const previous = role!.bindings.find((p) => p.policyId === b.policyId);
        if (
          b.expiresAt &&
          Date.parse(b.expiresAt) <= now &&
          b.expiresAt !== previous?.expiresAt
        )
          throw Error("EXPIRY_IN_PAST");
      }
      role!.bindings = change.bindings;
      break;
    }
    case "policy": {
      const policy = graph.policies.find((p) => p.id === change.policyId);
      if (!policy) throw Error("INVALID_REFERENCE");
      const keys = change.resources.map((r) => `${r.kind}/${r.id}`);
      if (
        !keys.length ||
        new Set(keys).size !== keys.length ||
        change.resources.some(
          (r) =>
            !graph.resources.some((v) => v.id === r.id && v.kind === r.kind),
        )
      )
        throw Error("INVALID_RESOURCES");
      policy.effect = change.effect;
      policy.resources = change.resources;
      break;
    }
    case "resource": {
      const resource = graph.resources.find(
        (r) => r.id === change.id && r.kind === change.kind,
      );
      if (!resource) throw Error("INVALID_REFERENCE");
      if (
        !change.name.trim() ||
        change.name.length > 120 ||
        change.description.length > 2000
      )
        throw Error("INVALID_RESOURCE");
      if (
        ["pages", "service-endpoints"].includes(change.kind) &&
        (!change.path.startsWith("/") ||
          change.path.startsWith("//") ||
          change.path.length > 2000)
      )
        throw Error("INVALID_PATH");
      if (
        change.kind === "service-endpoints" &&
        !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
          change.method,
        )
      )
        throw Error("INVALID_METHOD");
      Object.assign(resource, {
        name: change.name.trim(),
        description: change.description,
        path: change.path,
        method: change.method,
      });
      break;
    }
  }
  graph.revision++;
  return graph;
}
export function impact(
  graph: Graph,
  kind: ResourceKind,
  id: string,
  includeExpired = false,
  now = Date.now(),
) {
  return graph.policies
    .filter((p) => p.resources.some((r) => r.kind === kind && r.id === id))
    .map((policy) => ({
      policy,
      roles: graph.roles.flatMap((role) => {
        const binding = role.bindings.find((b) => b.policyId === policy.id);
        if (!binding) return [];
        const expired = Boolean(
          binding.expiresAt && Date.parse(binding.expiresAt) <= now,
        );
        if (expired && !includeExpired) return [];
        return [
          {
            role,
            binding,
            expired,
            users: graph.users.filter((u) => role.userIds.includes(u.id)),
            organizations: graph.organizations
              .filter((o) => role.organizationIds.includes(o.id))
              .map((o) => ({
                ...o,
                members: graph.users.filter((u) => o.memberIds.includes(u.id)),
              })),
          },
        ];
      }),
    }));
}
