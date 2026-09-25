import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyChange,
  impact,
  impactForResources,
  parseChange,
  type Graph,
} from "./model.ts";
const graph: Graph = {
  revision: 0,
  users: [
    { id: "u1", name: "User" },
    { id: "u2", name: "Member" },
  ],
  organizations: [{ id: "o1", name: "Org", memberIds: ["u1", "u2"] }],
  roles: [
    {
      id: "r1",
      name: "Role",
      description: "",
      userIds: ["u1"],
      organizationIds: ["o1"],
      bindings: [{ policyId: "p1", expiresAt: null }],
    },
  ],
  policies: [
    {
      id: "p1",
      name: "Policy",
      description: "",
      effect: "allow",
      resources: [{ kind: "pages", id: "page1" }],
    },
  ],
  resources: [
    {
      kind: "pages",
      id: "page1",
      name: "Page",
      description: "",
      path: "/page",
      method: "",
      parentId: "",
    },
  ],
};
test("selected-resource impact excludes outside scope and deduplicates shared connections", () => {
  const g = structuredClone(graph);
  g.policies[0].resources.push({ kind: "services", id: "page1" });
  g.users.push({ id: "outside", name: "Outside" });
  g.policies.push({
    ...g.policies[0],
    id: "outside-policy",
    resources: [{ kind: "pages", id: "outside" }],
  });
  g.roles.push({
    ...g.roles[0],
    id: "outside-role",
    userIds: ["outside"],
    organizationIds: [],
    bindings: [{ policyId: "outside-policy", expiresAt: null }],
  });
  const result = impactForResources(g, [
    { kind: "pages", id: "page1" },
    { kind: "services", id: "page1" },
    { kind: "pages", id: "page1" },
  ]);
  assert.deepEqual(result.counts, {
    resources: 2,
    policies: 1,
    roles: 1,
    organizations: 1,
    users: 2,
  });
  assert.equal(result.entries.length, 2);
  assert.deepEqual(impactForResources(g, []).counts, {
    resources: 0,
    policies: 0,
    roles: 0,
    organizations: 0,
    users: 0,
  });
  assert.equal(
    impactForResources(g, [{ kind: "pages", id: "outside" }]).counts.users,
    1,
  );
  g.roles[0].bindings[0].expiresAt = "2020-01-01T00:00:00Z";
  assert.equal(
    impactForResources(g, [{ kind: "services", id: "page1" }]).counts.users,
    0,
  );
  assert.equal(
    impactForResources(g, [{ kind: "services", id: "page1" }], true).counts
      .users,
    2,
  );
});
test("role grants replace direct assignments without changing organization membership", () => {
  const next = applyChange(graph, {
    type: "subjectRoles",
    subjectKind: "users",
    id: "u1",
    roleIds: [],
  });
  assert.deepEqual(next.roles[0].userIds, []);
  assert.deepEqual(next.organizations, graph.organizations);
  assert.equal(next.revision, 1);
  assert.deepEqual(graph.roles[0].userIds, ["u1"]);
});
test("policy expiry is scoped to the binding and excludes expired paths by default", () => {
  const next = applyChange(
    graph,
    {
      type: "bindings",
      roleId: "r1",
      bindings: [{ policyId: "p1", expiresAt: "2030-01-01T00:00:00Z" }],
    },
    0,
  );
  assert.equal(next.policies[0].effect, "allow");
  assert.equal(
    impact(next, "pages", "page1", false, Date.parse("2031-01-01"))[0].roles
      .length,
    0,
  );
  assert.equal(
    impact(next, "pages", "page1", true, Date.parse("2031-01-01"))[0].roles[0]
      .expired,
    true,
  );
  assert.throws(() =>
    applyChange(graph, {
      type: "bindings",
      roleId: "r1",
      bindings: [{ policyId: "p1", expiresAt: "2020-01-01T00:00:00Z" }],
    }),
  );
});
test("deny applies to selected resources and impact contains direct and inherited users", () => {
  const next = applyChange(graph, {
    type: "policy",
    policyId: "p1",
    effect: "deny",
    resources: [{ kind: "pages", id: "page1" }],
  });
  const result = impact(next, "pages", "page1")[0];
  assert.equal(result.policy.effect, "deny");
  assert.equal(result.roles[0].users.length, 1);
  assert.equal(result.roles[0].organizations[0].members.length, 2);
  assert.equal(impact(next, "services", "page1").length, 0);
});
test("rejects forged references, duplicate resources, empty policies and invalid resource fields", () => {
  assert.throws(() =>
    applyChange(graph, {
      type: "grants",
      roleId: "r1",
      userIds: ["not-found"],
      organizationIds: [],
    }),
  );
  assert.throws(() =>
    applyChange(graph, {
      type: "policy",
      policyId: "p1",
      effect: "allow",
      resources: [],
    }),
  );
  assert.throws(() =>
    applyChange(graph, {
      type: "policy",
      policyId: "p1",
      effect: "allow",
      resources: [
        { kind: "pages", id: "page1" },
        { kind: "pages", id: "page1" },
      ],
    }),
  );
  assert.throws(() =>
    applyChange(graph, {
      type: "resource",
      kind: "pages",
      id: "page1",
      name: "",
      description: "",
      path: "https://outside.test",
      method: "",
    }),
  );
  assert.throws(() =>
    parseChange({
      type: "bindings",
      roleId: "r1",
      bindings: [{ policyId: "p1", expiresAt: "tomorrow" }],
    }),
  );
});
