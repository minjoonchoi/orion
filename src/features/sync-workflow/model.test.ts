import test from "node:test";
import assert from "node:assert/strict";
import { stringify } from "yaml";
import {
  buildPlan,
  normalizeSelection,
  restorePlan,
  type Context,
} from "./model.ts";
import type { Graph } from "../authorization/model.ts";

function context(policy = false): Context {
  const resource = {
    kind: "services" as const,
    id: "svc",
    name: "Service",
    description: "",
    path: "",
    method: "",
    parentId: "",
  };
  const graph: Graph = {
    revision: 4,
    resources: [resource, { ...resource, id: "other" }],
    policies: [
      {
        id: "policy",
        name: "Policy",
        description: "",
        effect: "allow",
        resources: [{ kind: "services", id: "svc" }],
      },
    ],
    users: [
      { id: "u1", name: "One" },
      { id: "u2", name: "Two" },
    ],
    organizations: [{ id: "org", name: "Org", memberIds: ["u1", "u2"] }],
    roles: [
      {
        id: "role",
        name: "Role",
        description: "",
        userIds: ["u1"],
        organizationIds: ["org"],
        bindings: [{ policyId: "policy", expiresAt: null }],
      },
    ],
  };
  const metadata = { name: "test", environment: "test", region: "local" };
  const base = {
    dbRevision: 4,
    environment: "test",
    region: "local",
    cloudConfig: "ready" as const,
    appliedCommit: "old",
    candidateCommit: "new",
    digest: "hash",
    graph,
  };
  const rs = {
    ...base,
    yaml: stringify({
      apiVersion: "orion.io/v1alpha1",
      kind: "ResourceBundle",
      metadata,
      spec: {
        resources: [
          { ...resource, state: "present", name: "New service" },
          {
            ...resource,
            state: "present",
            id: "other",
            name: "Unrelated change",
          },
          {
            ...resource,
            state: "present",
            kind: "service-endpoints",
            id: "ep-new",
            parentId: "svc",
            path: "/new",
            method: "GET",
          },
        ],
      },
    }),
  };
  const ps = {
    ...base,
    yaml: stringify({
      apiVersion: "orion.io/v1alpha1",
      kind: "PolicyBundle",
      metadata,
      spec: {
        policies: [
          {
            id: "policy",
            state: "present",
            version: "v2",
            name: "Updated policy",
            description: "",
            effect: "allow",
            resources: [{ kind: "service-endpoints", id: "ep-new" }],
            processors: { pre: [], post: [] },
          },
        ],
      },
    }),
  };
  return {
    selection: policy
      ? { mode: "policies", policyIds: ["policy"], resources: [] }
      : {
          mode: "resources",
          resources: [{ kind: "services", id: "svc" }],
          policyIds: [],
        },
    resource: rs,
    policy: policy ? ps : null,
  };
}

test("selected-only Sync leaves unrelated pending changes and live grants intact", () => {
  const c = context();
  const original = structuredClone(c);
  const plan = buildPlan(c);
  assert.deepEqual(
    plan.changedResources.map((r) => r.id),
    ["svc"],
  );
  assert.equal(
    plan.next?.resources.find((r) => r.id === "other")?.name,
    "Service",
  );
  assert.equal(
    plan.next?.resources.some((r) => r.id === "ep-new"),
    false,
  );
  assert.equal(plan.next?.revision, 5);
  assert.equal(plan.next?.roles, c.resource.graph.roles);
  assert.equal(plan.next?.policies, c.resource.graph.policies);
  assert.deepEqual(c, original);
});
test("policy Sync includes a new endpoint and its parent, validates against the combined graph and deduplicates members", () => {
  const c = context(true);
  const plan = buildPlan(c);
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(
    plan.resources.map((r) => [r.id, r.reason]),
    [
      ["ep-new", "policy"],
      ["svc", "parent"],
    ],
  );
  assert.equal(plan.next?.revision, 5);
  assert.equal(plan.next?.policies[0].resources[0].id, "ep-new");
  assert.equal(
    plan.next?.resources.find((r) => r.id === "svc")?.name,
    "New service",
  );
  assert.equal(
    plan.next?.resources.find((r) => r.id === "other")?.name,
    "Service",
  );
  assert.deepEqual(plan.policyImpact, { roles: 1, organizations: 1, users: 2 });
  const after = {
    ...c,
    resource: { ...c.resource, graph: plan.next!, dbRevision: 5 },
    policy: { ...c.policy!, graph: plan.next!, dbRevision: 5 },
  };
  assert.equal(buildPlan(after).changedResources.length, 0);
  assert.equal(buildPlan(after).changedPolicies.length, 0);
});
test("missing dependencies or changed revisions prevent the whole plan", () => {
  const c = context(true);
  c.resource.yaml = c.resource.yaml.replace("id: ep-new", "id: ep-other");
  assert.equal(buildPlan(c).next, null);
  assert.ok(buildPlan(c).blockers.some((b) => b.includes("ep-new")));
  c.policy!.dbRevision = 5;
  assert.throws(() => buildPlan(c), /CONFLICT/);
});
test("resource selection deduplicates and rejects empty or ambiguous scope", () => {
  const s = context().selection;
  s.resources.push(s.resources[0]);
  assert.equal(normalizeSelection(s).resources.length, 1);
  assert.throws(
    () => normalizeSelection({ ...s, resources: [] }),
    /INVALID_SELECTION/,
  );
  assert.throws(
    () => normalizeSelection({ ...s, policyIds: ["policy"] }),
    /INVALID_SELECTION/,
  );
});
test("scoped rollback restores coupled definitions while keeping unrelated changes and assignments", () => {
  const c = context(true);
  const plan = buildPlan(c);
  const current = structuredClone(plan.next!);
  current.resources.find((r) => r.id === "other")!.name = "Keep me";
  current.roles[0].userIds.push("u2");
  const restored = restorePlan(
    current,
    c.resource.graph,
    ["policy"],
    plan.changedResources,
  );
  assert.equal(
    restored.resources.some((r) => r.id === "ep-new"),
    false,
  );
  assert.equal(restored.resources.find((r) => r.id === "svc")?.name, "Service");
  assert.equal(
    restored.resources.find((r) => r.id === "other")?.name,
    "Keep me",
  );
  assert.deepEqual(restored.roles[0].userIds, ["u1", "u2"]);
  assert.equal(restored.policies[0].resources[0].id, "svc");
  assert.throws(
    () => restorePlan(current, c.resource.graph, [], plan.changedResources),
    /BLOCKED/,
  );
});
