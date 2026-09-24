import { parseDocument } from "yaml";
import {
  graphSchema,
  impact,
  type Graph,
  type ResourceKind,
} from "../authorization/model.ts";
import {
  object,
  string,
  number,
  array,
  enumeration,
  optional,
  datetime,
} from "../../lib/api/schema.ts";
export const itemSchema = object({
  id: string,
  kind: enumeration([
    "workspaces",
    "pages",
    "services",
    "service-endpoints",
  ] as const),
  state: enumeration(["present", "absent"] as const),
  name: string,
  description: string,
  path: string,
  method: string,
  parentId: string,
});
export type Item = ReturnType<typeof itemSchema.parse>;
export const bundleSchema = object({
  apiVersion: enumeration(["orion.io/v1alpha1"] as const),
  kind: enumeration(["ResourceBundle"] as const),
  metadata: object({ name: string, environment: string, region: string }),
  spec: object({ resources: array(itemSchema) }),
});
export type Bundle = ReturnType<typeof bundleSchema.parse>;
export const snapshotSchema = object({
  dbRevision: number,
  appliedCommit: string,
  candidateCommit: string,
  digest: string,
  environment: string,
  region: string,
  cloudConfig: enumeration(["ready", "pending", "failed"] as const),
  yaml: string,
  graph: graphSchema,
});
export type Snapshot = ReturnType<typeof snapshotSchema.parse>;
export const previewSchema = object({
  token: string,
  expiresAt: string,
  snapshot: snapshotSchema,
});
export type Preview = ReturnType<typeof previewSchema.parse>;
export const runSchema = object({
  id: string,
  status: enumeration(["queued", "running", "succeeded", "failed"] as const),
  phase: string,
  message: string,
  commit: string,
  dbRevision: number,
  completedAt: optional(datetime),
});
export type Run = ReturnType<typeof runSchema.parse>;
export function parseBundle(
  yaml: string,
  environment: string,
  region: string,
): Bundle {
  if (yaml.length > 1000000) throw Error("INVALID_BUNDLE");
  const doc = parseDocument(yaml, { uniqueKeys: true });
  if (doc.errors.length) throw Error("INVALID_BUNDLE");
  const raw = doc.toJS({ maxAliasCount: 0 });
  const b = bundleSchema.parse(raw);
  // Fail closed on misspelled fields; never silently discard desired configuration.
  const exact = (v: object, keys: string[]) => {
    if (Object.keys(v).some((k) => !keys.includes(k)))
      throw Error("INVALID_BUNDLE");
  };
  exact(raw, ["apiVersion", "kind", "metadata", "spec"]);
  exact(raw.metadata, ["name", "environment", "region"]);
  exact(raw.spec, ["resources"]);
  if (b.metadata.environment !== environment || b.metadata.region !== region)
    throw Error("SCOPE_MISMATCH");
  const ids = new Set<string>();
  for (const [i, r] of b.spec.resources.entries()) {
    exact(raw.spec.resources[i], [
      "id",
      "kind",
      "state",
      "name",
      "description",
      "path",
      "method",
      "parentId",
    ]);
    const key = `${r.kind}:${r.id}`;
    if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(r.id) || ids.has(key))
      throw Error("INVALID_BUNDLE");
    ids.add(key);
    if (r.state === "absent") continue;
    if (!r.name.trim() || r.name.length > 120 || r.description.length > 2000)
      throw Error("INVALID_BUNDLE");
    if (["pages", "service-endpoints"].includes(r.kind)) {
      if (!r.parentId || !r.path.startsWith("/")) throw Error("INVALID_BUNDLE");
    } else if (r.parentId || r.path || r.method) throw Error("INVALID_BUNDLE");
    if (
      r.kind === "service-endpoints" &&
      !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
        r.method,
      )
    )
      throw Error("INVALID_BUNDLE");
    if (r.kind === "pages" && r.method) throw Error("INVALID_BUNDLE");
  }
  return b;
}
export function currentItem(r: Graph["resources"][number]): Item {
  return {
    id: r.id,
    kind: r.kind,
    state: "present",
    name: r.name,
    description: r.description,
    path: r.path,
    method: r.method,
    parentId: r.parentId ?? "",
  };
}
export function diff(snapshot: Snapshot) {
  const bundle = parseBundle(
    snapshot.yaml,
    snapshot.environment,
    snapshot.region,
  );
  const rows = bundle.spec.resources.map((after) => {
    const resource = snapshot.graph.resources.find(
      (r) => r.kind === after.kind && r.id === after.id,
    );
    const before = resource ? currentItem(resource) : null;
    const operation =
      after.state === "absent"
        ? before
          ? "delete"
          : "unchanged"
        : !before
          ? "create"
          : JSON.stringify(before) === JSON.stringify(after)
            ? "unchanged"
            : "update";
    const paths = impact(snapshot.graph, after.kind, after.id, true);
    const users = [
      ...new Set(
        paths.flatMap((p) =>
          p.roles.flatMap((r) => [
            ...r.users.map((u) => u.id),
            ...r.organizations.flatMap((o) => o.members.map((u) => u.id)),
          ]),
        ),
      ),
    ];
    return {
      key: `${after.kind}:${after.id}`,
      before,
      after,
      operation,
      paths,
      users,
    };
  });
  const desired = [...snapshot.graph.resources.map(currentItem)];
  for (const r of rows) {
    const i = desired.findIndex(
      (v) => v.id === r.after.id && v.kind === r.after.kind,
    );
    if (i >= 0) desired.splice(i, 1);
    if (r.after.state === "present") desired.push(r.after);
  }
  const blockers: string[] = [];
  if (snapshot.cloudConfig !== "ready") blockers.push("CONFIG_NOT_READY");
  for (const row of rows) {
    if (
      row.operation === "delete" &&
      snapshot.graph.policies.some((p) =>
        p.resources.some(
          (r) => r.kind === row.after.kind && r.id === row.after.id,
        ),
      )
    )
      blockers.push(`POLICY_REFERENCE:${row.key}`);
  }
  for (const r of desired) {
    if (["pages", "service-endpoints"].includes(r.kind) && !r.parentId)
      blockers.push(`PARENT_REFERENCE:${r.kind}:${r.id}`);
  }
  for (const r of desired) {
    if (
      r.parentId &&
      !desired.some(
        (p) =>
          p.id === r.parentId &&
          p.kind === (r.kind === "pages" ? "workspaces" : "services"),
      )
    )
      blockers.push(`PARENT_REFERENCE:${r.kind}:${r.id}`);
  }
  if (snapshot.dbRevision !== snapshot.graph.revision)
    blockers.push("REVISION_MISMATCH");
  return { rows, blockers, desired };
}
export function applySnapshot(snapshot: Snapshot): Graph {
  const result = diff(snapshot);
  if (result.blockers.length) throw Error("BLOCKED");
  const resources = result.desired.map((item) => {
    const existing = snapshot.graph.resources.find(
      (r) => r.id === item.id && r.kind === item.kind,
    );
    const { state: _state, ...fields } = item;
    void _state;
    return { ...existing, ...fields };
  });
  return {
    ...snapshot.graph,
    revision: snapshot.graph.revision + 1,
    resources,
  };
}
export const kindLabel: Record<ResourceKind, string> = {
  workspaces: "워크스페이스",
  pages: "페이지",
  services: "서비스",
  "service-endpoints": "서비스 엔드포인트",
};
