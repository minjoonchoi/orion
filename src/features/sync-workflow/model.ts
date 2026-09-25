import { stringify } from "yaml";
import {
  array,
  enumeration,
  nullable,
  object,
  string,
} from "../../lib/api/schema.ts";
import { resourceKinds, type ResourceRef } from "../authorization/model.ts";
import * as R from "../resource-sync/model.ts";
import * as P from "../policy-sync/model.ts";
import { restoreDefinitions } from "../authorization/rollback.ts";
import type { Graph } from "../authorization/model.ts";

export const selectionSchema = object({
  mode: enumeration(["resources", "policies"] as const),
  resources: array(object({ kind: enumeration(resourceKinds), id: string })),
  policyIds: array(string),
});
export type Selection = ReturnType<typeof selectionSchema.parse>;
export const contextSchema = object({
  selection: selectionSchema,
  resource: R.snapshotSchema,
  policy: nullable(P.snapshotSchema),
});
export type Context = ReturnType<typeof contextSchema.parse>;
export const previewSchema = object({
  token: string,
  expiresAt: string,
  context: contextSchema,
});
export type Preview = ReturnType<typeof previewSchema.parse>;
export const keyOf = (ref: ResourceRef) => `${ref.kind}:${ref.id}`;

export function restorePlan(
  current: Graph,
  target: Graph,
  policyIds: string[],
  resources: ResourceRef[],
) {
  const keys = new Set(resources.map(keyOf));
  const candidate = {
    ...current,
    resources: [
      ...current.resources.filter((r) => !keys.has(keyOf(r))),
      ...target.resources.filter((r) => keys.has(keyOf(r))),
    ],
    policies: [
      ...current.policies.filter((p) => !policyIds.includes(p.id)),
      ...target.policies.filter((p) => policyIds.includes(p.id)),
    ],
  };
  // Validate the combined final graph before a single write; retain all live grants.
  return restoreDefinitions(candidate, candidate, "policies");
}

export function normalizeSelection(input: unknown): Selection {
  const s = selectionSchema.parse(input);
  s.resources = [
    ...new Map(s.resources.map((r) => [keyOf(r), r])).values(),
  ].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  s.policyIds = [...new Set(s.policyIds)].sort();
  if (
    (s.mode === "resources" && (!s.resources.length || s.policyIds.length)) ||
    (s.mode === "policies" && !s.policyIds.length) ||
    s.resources.length + s.policyIds.length > 500 ||
    [...s.resources.map((r) => r.id), ...s.policyIds].some(
      (id) => !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(id),
    )
  )
    throw Error("INVALID_SELECTION");
  return s;
}

export function buildPlan(context: Context) {
  const selection = normalizeSelection(context.selection);
  const rs = context.resource;
  const ps = context.policy;
  if (selection.mode === "resources" && ps) throw Error("CONFLICT");
  if (
    selection.mode === "policies" &&
    (!ps ||
      ps.dbRevision !== rs.dbRevision ||
      ps.environment !== rs.environment ||
      ps.region !== rs.region ||
      JSON.stringify(ps.graph.resources) !== JSON.stringify(rs.graph.resources))
  )
    throw Error("CONFLICT");
  const graph = ps?.graph ?? rs.graph;
  const resourceBundle = R.parseBundle(rs.yaml, rs.environment, rs.region);
  const policyBundle = ps
    ? P.parseBundle(ps.yaml, ps.environment, ps.region)
    : null;
  const blockers: string[] = [];
  const refs = new Map<
    string,
    {
      kind: ResourceRef["kind"];
      id: string;
      reason: "selected" | "policy" | "parent";
    }
  >();
  selection.resources.forEach((r) =>
    refs.set(keyOf(r), { ...r, reason: "selected" }),
  );
  const policyDefinitions =
    policyBundle?.spec.policies.filter((p) =>
      selection.policyIds.includes(p.id),
    ) ?? [];
  for (const id of selection.policyIds)
    if (!policyDefinitions.some((p) => p.id === id))
      blockers.push(`MISSING_POLICY:${id}`);
  for (const policy of policyDefinitions)
    if (policy.state === "present")
      for (const ref of policy.resources)
        if (!refs.has(keyOf(ref)))
          refs.set(keyOf(ref), { ...ref, reason: "policy" });
  // Add ancestors explicitly. No siblings or unrelated definitions are selected.
  for (const ref of refs.values()) {
    const desired = resourceBundle.spec.resources.find(
      (r) => keyOf(r) === keyOf(ref),
    );
    const current = graph.resources.find((r) => keyOf(r) === keyOf(ref));
    if (!desired && !current) blockers.push(`MISSING_RESOURCE:${keyOf(ref)}`);
    const item = desired ?? current;
    if (
      item &&
      (!("state" in item) || item.state !== "absent") &&
      item.parentId
    ) {
      const parent = {
        kind: (item.kind === "pages"
          ? "workspaces"
          : "services") as ResourceRef["kind"],
        id: item.parentId,
      };
      if (!refs.has(keyOf(parent)))
        refs.set(keyOf(parent), { ...parent, reason: "parent" });
    }
  }
  const resourceInput = {
    ...rs,
    graph,
    yaml: stringify({
      ...resourceBundle,
      spec: {
        resources: resourceBundle.spec.resources.filter((r) =>
          refs.has(keyOf(r)),
        ),
      },
    }),
  };
  const resourceDiff = R.diff(resourceInput);
  const projectedResources = resourceDiff.desired.map((item) => {
    const { state, ...fields } = item;
    void state;
    return {
      ...graph.resources.find((r) => keyOf(r) === keyOf(item)),
      ...fields,
    };
  });
  const policyInput =
    ps && policyBundle
      ? {
          ...ps,
          graph: { ...graph, resources: projectedResources },
          yaml: stringify({
            ...policyBundle,
            spec: { policies: policyDefinitions },
          }),
        }
      : null;
  const policyDiff = policyInput ? P.diff(policyInput) : null;
  if (policyDiff) blockers.push(...policyDiff.blockers);
  const policyGraph =
    policyInput && !policyDiff!.blockers.length
      ? P.applySnapshot(policyInput)
      : graph;
  if (policyGraph !== graph)
    policyGraph.policies = [
      ...graph.policies.filter((p) => !selection.policyIds.includes(p.id)),
      ...policyGraph.policies.filter((p) => selection.policyIds.includes(p.id)),
    ];
  const finalResourceInput = {
    ...resourceInput,
    graph: { ...graph, policies: policyGraph.policies },
  };
  blockers.push(...R.diff(finalResourceInput).blockers);
  const resources = [...refs.values()].map((ref) => {
    const row = resourceDiff.rows.find((row) => row.key === keyOf(ref));
    const current = graph.resources.find((r) => keyOf(r) === keyOf(ref));
    const before = current ? R.currentItem(current) : null;
    return {
      ...ref,
      before,
      after: row?.after ?? before,
      operation: row?.operation ?? "unchanged",
      managed: Boolean(row),
    };
  });
  const changedResources = resources.filter((r) => r.operation !== "unchanged");
  const policies = policyDiff?.rows ?? [];
  const changedPolicies = policies.filter((p) => p.operation !== "unchanged");
  const next = blockers.length
    ? null
    : {
        ...R.applySnapshot(finalResourceInput),
        policies: policyGraph.policies,
        revision: graph.revision + 1,
      };
  const policyRoles = policies.flatMap((p) => p.impact.roles);
  const policyImpact = {
    roles: new Set(policyRoles.map((r) => r.role.id)).size,
    organizations: new Set(
      policyRoles.flatMap((r) => r.organizations.map((o) => o.id)),
    ).size,
    users: new Set(
      policyRoles.flatMap((r) => [
        ...r.users.map((u) => u.id),
        ...r.organizations.flatMap((o) => o.members.map((u) => u.id)),
      ]),
    ).size,
  };
  return {
    selection,
    resources,
    policies,
    changedResources,
    changedPolicies,
    blockers: [...new Set(blockers)],
    next,
    policyImpact,
  };
}
