import test from "node:test";
import assert from "node:assert/strict";
import { restoreDefinitions } from "./rollback.ts";
import type { Graph } from "./model.ts";

const current: Graph = {
  revision: 9,
  users: [{ id: "user", name: "User" }],
  organizations: [],
  roles: [
    {
      id: "role",
      name: "Role",
      description: "",
      userIds: ["user"],
      organizationIds: [],
      bindings: [{ policyId: "policy", expiresAt: null }],
    },
  ],
  policies: [
    {
      id: "policy",
      name: "Policy",
      description: "",
      effect: "allow",
      resources: [{ kind: "services", id: "service" }],
    },
  ],
  resources: [
    {
      id: "service",
      kind: "services",
      name: "New",
      description: "",
      path: "",
      method: "",
      parentId: "",
    },
  ],
};
test("resource rollback preserves current users, grants and policies", () => {
  const target = structuredClone(current);
  target.roles = [];
  target.users = [];
  target.resources[0].name = "Old";
  const restored = restoreDefinitions(current, target, "resources");
  assert.deepEqual(restored.roles, current.roles);
  assert.deepEqual(restored.users, current.users);
  assert.equal(restored.resources[0].name, "Old");
  assert.equal(restored.revision, 10);
});
test("rollback blocks missing policy/resource dependencies", () => {
  const target = structuredClone(current);
  target.policies = [];
  target.resources = [];
  assert.throws(
    () => restoreDefinitions(current, target, "policies"),
    /BLOCKED/,
  );
  assert.throws(
    () => restoreDefinitions(current, target, "resources"),
    /BLOCKED/,
  );
});
