import type { Graph, ResourceKind } from "../authorization/model.ts";
import { restoreDefinitions } from "../authorization/rollback.ts";

export function restoreResource<T extends Graph>(
  current: T,
  target: Graph,
  kind: ResourceKind,
  id: string,
): T {
  const selected = target.resources.find((r) => r.kind === kind && r.id === id);
  const resources = current.resources.filter(
    (r) => r.kind !== kind || r.id !== id,
  );
  if (selected) resources.push(structuredClone(selected));
  return restoreDefinitions(current, { ...current, resources }, "resources");
}
