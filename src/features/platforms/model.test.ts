import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateDirectory,
  changeRecipients,
  updateUserRoles,
  userRoleIds,
  type Directory,
} from "./model.ts";
function fixture(): Directory {
  return validateDirectory({
    revision: 0,
    platforms: ["orion", "finance"].map((id) => ({
      id,
      name: id,
      description: "",
      status: "active",
      provider: "Okta",
      issuer: "https://example.test",
      clientId: id,
      loginPath: "/login",
    })),
    users: [{ id: "u1", name: "User", email: "u@example.test" }],
    members: [
      {
        id: "m1",
        platformId: "orion",
        userId: "u1",
        name: "User",
        email: "u@example.test",
        status: "active",
      },
    ],
    roles: [
      {
        id: "r1",
        platformId: "orion",
        name: "Orion",
        description: "",
        policyIds: [],
      },
      {
        id: "r2",
        platformId: "finance",
        name: "Finance",
        description: "",
        policyIds: [],
      },
    ],
    userRoles: [{ userId: "u1", platformId: "orion", roleIds: ["r1"] }],
    accounts: [],
    organizations: [],
    workspaces: [],
    policies: [],
  });
}
test("roles belong to users, including before membership exists", () => {
  const d = fixture(),
    next = updateUserRoles(d, "finance", "u1", ["r2"], 0);
  assert.deepEqual(userRoleIds(next, "u1", "finance"), ["r2"]);
  assert.deepEqual(userRoleIds(next, "u1", "orion"), ["r1"]);
  assert.deepEqual(next.members, d.members);
  assert.equal("roleIds" in next.members[0], false);
  assert.equal(d.revision, 0);
});
test("cross-platform assignment and stale revisions rejected", () => {
  assert.throws(
    () => updateUserRoles(fixture(), "orion", "u1", ["r2"], 0),
    /ROLE_SCOPE_MISMATCH/,
  );
  assert.throws(
    () => updateUserRoles(fixture(), "orion", "u1", [], 1),
    /REVISION_CONFLICT/,
  );
});
test("service accounts accept only Orion roles", () => {
  const d = fixture();
  d.accounts = [{ id: "sa1", name: "Server", roleIds: ["r2"] }];
  assert.throws(() => validateDirectory(d), /SERVICE_ACCOUNT_ROLE_SCOPE/);
});
test("removal preserves the user's other platform roles and membership", () => {
  const d = updateUserRoles(fixture(), "finance", "u1", ["r2"], 0);
  const next = updateUserRoles(d, "orion", "u1", [], 1);
  assert.deepEqual(userRoleIds(next, "u1", "orion"), []);
  assert.deepEqual(userRoleIds(next, "u1", "finance"), ["r2"]);
  assert.deepEqual(next.members, d.members);
});

test("role detail adds users without changing other roles or memberships", () => {
  const d = fixture();
  d.users.push({ id: "u2", name: "Second", email: "two@example.test" });
  const next = changeRecipients(d, {
    kind: "role-users",
    platformId: "orion",
    roleId: "r1",
    operation: "add",
    userIds: ["u2"],
    expectedRevision: 0,
  });
  assert.deepEqual(userRoleIds(next, "u2", "orion"), ["r1"]);
  assert.deepEqual(userRoleIds(next, "u1", "orion"), ["r1"]);
  assert.deepEqual(next.members, d.members);
});
test("platform detail adds members without granting roles or affecting other platforms", () => {
  const d = fixture();
  const next = changeRecipients(d, {
    kind: "members",
    platformId: "finance",
    operation: "add",
    userIds: ["u1"],
    expectedRevision: 0,
  });
  assert.equal(next.members.length, 2);
  assert.equal(
    next.members.find((m) => m.platformId === "finance")?.status,
    "active",
  );
  assert.deepEqual(next.userRoles, d.userRoles);
  assert.deepEqual(next.members[0], d.members[0]);
  assert.throws(
    () =>
      changeRecipients(next, {
        kind: "members",
        platformId: "finance",
        operation: "add",
        userIds: ["u1"],
        expectedRevision: 1,
      }),
    /ALREADY_MEMBER/,
  );
});
test("batch assignments reject unknown users atomically and enforce role scope", () => {
  const d = fixture();
  assert.throws(
    () =>
      changeRecipients(d, {
        kind: "role-users",
        platformId: "finance",
        roleId: "r2",
        operation: "add",
        userIds: ["u1", "missing"],
        expectedRevision: 0,
      }),
    /INVALID_USERS/,
  );
  assert.deepEqual(userRoleIds(d, "u1", "finance"), []);
  assert.throws(
    () =>
      changeRecipients(d, {
        kind: "role-users",
        platformId: "finance",
        roleId: "r1",
        operation: "add",
        userIds: ["u1"],
        expectedRevision: 0,
      }),
    /ROLE_SCOPE_MISMATCH/,
  );
  assert.throws(
    () =>
      changeRecipients(d, {
        kind: "members",
        platformId: "finance",
        operation: "add",
        userIds: ["u1"],
        expectedRevision: 3,
      }),
    /REVISION_CONFLICT/,
  );
});
test("role detail removes only its own assignments", () => {
  const d = updateUserRoles(fixture(), "finance", "u1", ["r2"], 0);
  const next = changeRecipients(d, {
    kind: "role-users",
    platformId: "orion",
    roleId: "r1",
    operation: "remove",
    userIds: ["u1"],
    expectedRevision: 1,
  });
  assert.deepEqual(userRoleIds(next, "u1", "orion"), []);
  assert.deepEqual(userRoleIds(next, "u1", "finance"), ["r2"]);
  assert.deepEqual(next.members, d.members);
});
