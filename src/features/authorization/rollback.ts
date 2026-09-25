import type { Graph } from "./model.ts";

// Restore only the managed definition set. Live assignments must survive rollback.
export function restoreDefinitions<T extends Graph>(
  current: T,
  target: T,
  scope: "resources" | "policies",
): T {
  const next = {
    ...current,
    [scope]: structuredClone(target[scope]),
    revision: current.revision + 1,
  };
  for (const policy of next.policies) {
    if (
      policy.resources.some(
        (ref) =>
          !next.resources.some((r) => r.kind === ref.kind && r.id === ref.id),
      )
    )
      throw Error("BLOCKED");
  }
  if (
    next.roles.some((role) =>
      role.bindings.some(
        (b) => !next.policies.some((p) => p.id === b.policyId),
      ),
    )
  )
    throw Error("BLOCKED");
  for (const resource of next.resources) {
    if (
      ["pages", "service-endpoints"].includes(resource.kind) &&
      !next.resources.some(
        (parent) =>
          parent.id === resource.parentId &&
          parent.kind ===
            (resource.kind === "pages" ? "workspaces" : "services"),
      )
    )
      throw Error("BLOCKED");
  }
  return next;
}
