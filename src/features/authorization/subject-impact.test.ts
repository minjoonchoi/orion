import test from "node:test";
import assert from "node:assert/strict";
import { graphSchema, applyChange, type Graph } from "./model.ts";
import { subjectImpact, compareSubjectImpact } from "./subject-impact.ts";
const graph: Graph = {
  revision: 0,
  users: [
    { id: "shared", name: "User" },
    { id: "member", name: "Member" },
  ],
  organizations: [{ id: "org", name: "Org", memberIds: ["shared", "member"] }],
  serviceAccounts: [
    { id: "shared", name: "Robot", organizationId: "org", roleIds: ["role"] },
    {
      id: "owner-only",
      name: "Not inherited",
      organizationId: "org",
      roleIds: [],
    },
  ],
  roles: [
    {
      id: "role",
      name: "Role",
      description: "",
      userIds: ["shared"],
      organizationIds: ["org"],
      bindings: [{ policyId: "policy", expiresAt: null }],
    },
    {
      id: "other-role",
      name: "Unrelated",
      description: "",
      userIds: ["member"],
      organizationIds: [],
      bindings: [{ policyId: "other-policy", expiresAt: null }],
    },
  ],
  policies: [
    {
      id: "policy",
      name: "Policy",
      description: "",
      effect: "allow",
      resources: [
        { kind: "services", id: "one" },
        { kind: "pages", id: "one" },
      ],
    },
    {
      id: "other-policy",
      name: "Outside",
      description: "",
      effect: "deny",
      resources: [{ kind: "services", id: "outside" }],
    },
  ],
  resources: [],
};
test("subject impact deduplicates subjects while retaining direct and organization paths; service-account ownership never inherits", () => {
  const result = subjectImpact(graph, {
    resources: [
      { kind: "services", id: "one" },
      { kind: "services", id: "one" },
    ],
  });
  assert.equal(result.length, 4);
  const user = result.find((s) => s.kind === "users" && s.id === "shared")!;
  assert.equal(user.paths.length, 2);
  assert.deepEqual(
    new Set(user.paths.map((p) => p.via?.id ?? "direct")),
    new Set(["direct", "org"]),
  );
  assert.ok(
    result.every((s) =>
      s.paths.every(
        (p) =>
          p.policy.id === "policy" &&
          p.resources.length === 1 &&
          p.resources[0].kind === "services",
      ),
    ),
  );
  assert.equal(result.filter((s) => s.kind === "service-accounts").length, 1);
  assert.equal(
    result.some((s) => s.id === "owner-only"),
    false,
  );
});
test("policy scopes exclude other policies and merge selected resource evidence on each assignment path", () => {
  const result = subjectImpact(graph, { policyIds: ["policy"] });
  assert.ok(
    result.every((s) =>
      s.paths.every(
        (p) => p.policy.id === "policy" && p.resources.length === 2,
      ),
    ),
  );
  assert.equal(subjectImpact(graph, { resources: [] }).length, 0);
  assert.equal(subjectImpact(graph, { policyIds: [] }).length, 0);
  const expired = structuredClone(graph);
  expired.roles[0].bindings[0].expiresAt = "2020-01-01T00:00:00Z";
  assert.equal(subjectImpact(expired, { policyIds: ["policy"] }).length, 0);
  assert.equal(
    subjectImpact(expired, { policyIds: ["policy"] }, true).length,
    4,
  );
  assert.ok(
    subjectImpact(expired, { policyIds: ["policy"] }, true).every((s) =>
      s.paths.every((p) => p.expired),
    ),
  );
});
test("binding removals report users, organization and robots, without unchanged assignment paths", () => {
  const after = applyChange(graph, {
    type: "bindings",
    roleId: "role",
    bindings: [],
  });
  const delta = compareSubjectImpact(graph, after, { roleIds: ["role"] });
  assert.equal(delta.length, 4);
  assert.ok(
    delta.every((s) =>
      s.paths.every((p) => p.change === "removed" && p.policy.id === "policy"),
    ),
  );
  const grants = applyChange(graph, {
    type: "grants",
    roleId: "role",
    userIds: [],
    organizationIds: ["org"],
  });
  const direct = compareSubjectImpact(graph, grants, { roleIds: ["role"] });
  assert.equal(direct.length, 1);
  assert.equal(direct[0].paths.length, 1);
  assert.equal(direct[0].paths[0].via, null);
  assert.deepEqual(grants.serviceAccounts, graph.serviceAccounts);
});
test("API graph preserves account role links and distinguishes unavailable data from an empty result", () => {
  assert.deepEqual(
    graphSchema.parse(graph).serviceAccounts,
    graph.serviceAccounts,
  );
  assert.equal(
    graphSchema.parse({ ...graph, serviceAccounts: undefined }).serviceAccounts,
    undefined,
  );
  assert.deepEqual(
    graphSchema.parse({ ...graph, serviceAccounts: [] }).serviceAccounts,
    [],
  );
  assert.throws(() =>
    graphSchema.parse({
      ...graph,
      serviceAccounts: [
        {
          id: "invalid",
          name: "Invalid",
          organizationId: "org",
          roleIds: "role",
        },
      ],
    }),
  );
});
