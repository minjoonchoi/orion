import { parseDocument, stringify } from "yaml";
import {
  graphSchema,
  resourceKinds,
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
  type Schema,
} from "../../lib/api/schema.ts";

const processorConfig = { parse: (value: unknown) => value };
export const processorSchema = object({
  endpointId: string,
  target: enumeration([
    "request.query",
    "request.body",
    "response.body",
  ] as const),
  handler: string,
  mode: enumeration(["required", "optional"] as const),
  config: optional(processorConfig),
});
export const policyDefinitionSchema = object({
  id: string,
  state: enumeration(["present", "absent"] as const),
  version: string,
  name: string,
  description: string,
  effect: enumeration(["allow", "deny"] as const),
  resources: array(object({ kind: enumeration(resourceKinds), id: string })),
  processors: object({
    pre: array(processorSchema),
    post: array(processorSchema),
  }),
});
export type PolicyDefinition = ReturnType<typeof policyDefinitionSchema.parse>;
type StoredPolicyProcessor = {
  endpointId: string;
  target: "request.query" | "request.body" | "response.body";
  phase: "pre" | "post";
  handler: string;
  mode: "required" | "optional";
  config?: unknown;
};
type PolicyGraph = Omit<Graph, "policies"> & {
  policies: (Graph["policies"][number] & {
    definitionVersion?: string;
    processors?: StoredPolicyProcessor[];
  })[];
};
const storedProcessorSchema = object({
  endpointId: string,
  target: enumeration([
    "request.query",
    "request.body",
    "response.body",
  ] as const),
  phase: enumeration(["pre", "post"] as const),
  handler: string,
  mode: enumeration(["required", "optional"] as const),
  config: optional(processorConfig),
});
const policyGraphSchema: Schema<PolicyGraph> = {
  parse(value) {
    const graph = graphSchema.parse(value);
    const rawPolicies =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as { policies?: unknown }).policies
        : undefined;
    return {
      ...graph,
      policies: graph.policies.map((policy, index) => {
        const raw =
          Array.isArray(rawPolicies) &&
          rawPolicies[index] &&
          typeof rawPolicies[index] === "object"
            ? (rawPolicies[index] as {
                definitionVersion?: unknown;
                processors?: unknown;
              })
            : {};
        const definitionVersion = optional(string).parse(raw.definitionVersion);
        const processors =
          raw.processors === undefined
            ? undefined
            : array(storedProcessorSchema).parse(raw.processors);
        return {
          ...policy,
          ...(definitionVersion === undefined ? {} : { definitionVersion }),
          ...(processors === undefined ? {} : { processors }),
        };
      }),
    };
  },
};
export const bundleSchema = object({
  apiVersion: enumeration(["orion.io/v1alpha1"] as const),
  kind: enumeration(["PolicyBundle"] as const),
  metadata: object({ name: string, environment: string, region: string }),
  spec: object({ policies: array(policyDefinitionSchema) }),
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
  graph: policyGraphSchema,
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
  rollbackOf: optional(string),
  targetRevision: optional(number),
  policyIds: optional(array(string)),
  resourceRefs: optional(
    array(object({ kind: enumeration(resourceKinds), id: string })),
  ),
});
export type Run = ReturnType<typeof runSchema.parse>;

function exact(v: object, keys: string[]) {
  if (Object.keys(v).some((k) => !keys.includes(k)))
    throw Error("INVALID_POLICY_PACKAGE");
}

export function parseBundle(
  yaml: string,
  environment: string,
  region: string,
): Bundle {
  if (yaml.length > 1000000) throw Error("INVALID_POLICY_PACKAGE");
  const doc = parseDocument(yaml, { uniqueKeys: true });
  if (doc.errors.length) throw Error("INVALID_POLICY_PACKAGE");
  const raw = doc.toJS({ maxAliasCount: 0 });
  const bundle = bundleSchema.parse(raw);
  exact(raw, ["apiVersion", "kind", "metadata", "spec"]);
  exact(raw.metadata, ["name", "environment", "region"]);
  exact(raw.spec, ["policies"]);
  if (
    bundle.metadata.environment !== environment ||
    bundle.metadata.region !== region
  )
    throw Error("SCOPE_MISMATCH");
  const ids = new Set<string>();
  for (const [i, policy] of bundle.spec.policies.entries()) {
    const row = raw.spec.policies[i];
    exact(row, [
      "id",
      "state",
      "version",
      "name",
      "description",
      "effect",
      "resources",
      "processors",
    ]);
    exact(row.processors, ["pre", "post"]);
    if (!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(policy.id) || ids.has(policy.id))
      throw Error("INVALID_POLICY_PACKAGE");
    ids.add(policy.id);
    if (policy.state === "absent") continue;
    if (
      !policy.name.trim() ||
      !policy.version.trim() ||
      policy.name.length > 120 ||
      policy.description.length > 2000 ||
      !policy.resources.length
    )
      throw Error("INVALID_POLICY_PACKAGE");
    const refs = policy.resources.map((r) => `${r.kind}:${r.id}`);
    if (new Set(refs).size !== refs.length)
      throw Error("INVALID_POLICY_PACKAGE");
    for (const processor of [
      ...policy.processors.pre,
      ...policy.processors.post,
    ]) {
      if (
        policy.effect !== "allow" ||
        !policy.resources.some(
          (r) =>
            r.kind === "service-endpoints" && r.id === processor.endpointId,
        )
      )
        throw Error("INVALID_PROCESSOR_ENDPOINT");
      if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(processor.handler))
        throw Error("INVALID_POLICY_PACKAGE");
    }
    if (
      policy.processors.pre.some((p) => p.target === "response.body") ||
      policy.processors.post.some((p) => p.target !== "response.body")
    )
      throw Error("INVALID_PROCESSOR_PHASE");
  }
  return bundle;
}

export function currentPolicy(
  policy: PolicyGraph["policies"][number],
): PolicyDefinition {
  return {
    id: policy.id,
    state: "present",
    version: policy.definitionVersion ?? "db-current",
    name: policy.name,
    description: policy.description,
    effect: policy.effect,
    resources: policy.resources,
    processors: {
      pre:
        policy.processors
          ?.filter((p) => p.phase === "pre")
          .map((p) => ({
            endpointId: p.endpointId,
            target: p.target,
            handler: p.handler,
            mode: p.mode,
            config: p.config,
          })) ?? [],
      post:
        policy.processors
          ?.filter((p) => p.phase === "post")
          .map((p) => ({
            endpointId: p.endpointId,
            target: p.target,
            handler: p.handler,
            mode: p.mode,
            config: p.config,
          })) ?? [],
    },
  };
}

export function policyYamlForScope(
  yaml: string,
  environment: string,
  region: string,
) {
  const bundle = parseBundle(yaml, "development", "ap-northeast-2");
  bundle.metadata.environment = environment;
  bundle.metadata.region = region;
  return stringify(bundle);
}

export function policyImpact(graph: Graph, policyId: string) {
  const roles = graph.roles.flatMap((role) => {
    const binding = role.bindings.find((b) => b.policyId === policyId);
    if (!binding) return [];
    const users = role.userIds
      .map((id) => graph.users.find((u) => u.id === id))
      .filter((u): u is Graph["users"][number] => Boolean(u));
    const organizations = role.organizationIds
      .map((id) => graph.organizations.find((o) => o.id === id))
      .filter((o): o is Graph["organizations"][number] => Boolean(o))
      .map((o) => ({
        ...o,
        members: o.memberIds
          .map((id) => graph.users.find((u) => u.id === id))
          .filter((u): u is Graph["users"][number] => Boolean(u)),
      }));
    return [{ role, users, organizations, binding }];
  });
  return {
    roles,
    userCount: new Set(
      roles.flatMap((r) => [
        ...r.users.map((u) => u.id),
        ...r.organizations.flatMap((o) => o.members.map((u) => u.id)),
      ]),
    ).size,
  };
}

export function diff(snapshot: Snapshot) {
  const bundle = parseBundle(
    snapshot.yaml,
    snapshot.environment,
    snapshot.region,
  );
  const rows = bundle.spec.policies.map((after) => {
    const policy = snapshot.graph.policies.find((p) => p.id === after.id);
    const before = policy ? currentPolicy(policy) : null;
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
    return {
      key: after.id,
      before,
      after,
      operation,
      impact: policyImpact(snapshot.graph, after.id),
    };
  });
  const desired = [...snapshot.graph.policies.map(currentPolicy)];
  for (const row of rows) {
    const i = desired.findIndex((p) => p.id === row.after.id);
    if (i >= 0) desired.splice(i, 1);
    if (row.after.state === "present") desired.push(row.after);
  }
  const blockers: string[] = [];
  if (snapshot.cloudConfig !== "ready") blockers.push("CONFIG_NOT_READY");
  for (const row of rows) {
    if (row.operation === "delete" && row.impact.roles.length)
      blockers.push(`ROLE_REFERENCE:${row.key}`);
    if (row.after.state === "present") {
      for (const ref of row.after.resources) {
        if (
          !snapshot.graph.resources.some(
            (r) => r.kind === ref.kind && r.id === ref.id,
          )
        )
          blockers.push(`RESOURCE_REFERENCE:${row.key}:${ref.kind}:${ref.id}`);
      }
    }
  }
  if (snapshot.dbRevision !== snapshot.graph.revision)
    blockers.push("REVISION_MISMATCH");
  return { rows, blockers, desired };
}

export function applySnapshot(snapshot: Snapshot): Graph {
  const result = diff(snapshot);
  if (result.blockers.length) throw Error("BLOCKED");
  return {
    ...snapshot.graph,
    revision: snapshot.graph.revision + 1,
    policies: result.desired.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      effect: p.effect,
      resources: p.resources,
      definitionVersion: p.version,
      processors: [
        ...p.processors.pre.map((processor) => ({
          phase: "pre" as const,
          ...processor,
        })),
        ...p.processors.post.map((processor) => ({
          phase: "post" as const,
          ...processor,
        })),
      ],
    })),
  };
}

export const resourceLabel: Record<ResourceKind, string> = {
  workspaces: "워크스페이스",
  pages: "페이지",
  services: "서비스",
  "service-endpoints": "서비스 엔드포인트",
  domains: "업무 도메인",
  actions: "Action",
};
