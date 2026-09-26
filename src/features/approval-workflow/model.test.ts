import test from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  canRead,
  canAddViewer,
  publicState,
  stateSchema,
  type State,
  type Command,
} from "./model.ts";
import { seed } from "./demo.ts";
const now = "2026-09-26T09:00:00Z";
function change(s: State, c: Command, hash = "test-server-hash") {
  return apply(s, c, s.revision, now, hash);
}
function approve(s: State) {
  for (const actor of ["usr-002", "usr-003", "usr-001"])
    s = change(
      { ...s, actorId: actor },
      { kind: "decide", id: "approval-demo-001", decision: "approved" },
    );
  return s;
}
function issue() {
  return change(approve(seed()), {
    kind: "execute",
    id: "approval-demo-001",
    secretText: "synthetic-value",
  });
}
test("request snapshots template and ACL, no key/role/policy before execution", () => {
  const s = seed();
  assert.equal(s.keys.length, 0);
  assert.equal(s.roles.length, 0);
  assert.equal(s.policies.length, 0);
  assert.equal(s.documents[0].line.length, 3);
  assert.ok(s.documents[0].viewers.some((v) => v.target.id === "org-security"));
  assert.deepEqual(stateSchema.parse(s), s);
});
test("approval complete does not issue a key", () => {
  const s = approve(seed());
  assert.equal(s.documents[0].execution, "ready");
  assert.equal(s.keys.length, 0);
});
test("current organization membership and explicit users are the only read gate", () => {
  let s = seed();
  s = {
    ...s,
    actorId: "usr-014",
    memberships: s.memberships.filter((m) => m.userId !== "usr-014"),
  };
  assert.equal(canRead(s, s.documents[0]), false);
  assert.equal(publicState(s).documents.length, 0);
  assert.throws(
    () =>
      change(s, {
        kind: "viewer",
        id: s.documents[0].id,
        target: { kind: "user", id: "usr-014" },
      }),
    /FORBIDDEN/,
  );
  s = { ...s, actorId: "usr-002" };
  s = change(s, {
    kind: "viewer",
    id: s.documents[0].id,
    target: { kind: "user", id: "usr-014" },
  });
  s.actorId = "usr-014";
  assert.equal(canRead(s, s.documents[0]), true);
  assert.equal(canAddViewer(s, s.documents[0]), false);
});
test("only current stage can approve and revision is checked", () => {
  const s = seed();
  assert.throws(
    () =>
      change(s, {
        kind: "decide",
        id: s.documents[0].id,
        decision: "approved",
      }),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      apply(
        s,
        { kind: "decide", id: s.documents[0].id, decision: "approved" },
        0,
        now,
      ),
    /REVISION_CONFLICT/,
  );
});
test("view access does not allow execution", () => {
  const s = approve(seed());
  s.actorId = "usr-003";
  s.memberships = s.memberships.filter(
    (m) => m.userId !== "usr-003" || m.organizationId !== "org-platform",
  );
  assert.throws(
    () =>
      change(s, {
        kind: "execute",
        id: s.documents[0].id,
        secretText: "synthetic-value",
      }),
    /FORBIDDEN/,
  );
});
test("execution creates policy+Orion role+assignment and persists only hash", () => {
  const s = issue();
  assert.equal(s.keys.length, 1);
  assert.equal(s.roles[0].platformId, "orion");
  assert.equal(s.roles[0].accountId, s.keys[0].accountId);
  assert.deepEqual(s.policies[0].endpointIds, ["ep-users", "ep-orgs"]);
  assert.equal(s.keys[0].hash, "test-server-hash");
  assert.ok(!JSON.stringify(s).includes("synthetic-value"));
  assert.throws(
    () =>
      change(s, {
        kind: "execute",
        id: s.documents[0].id,
        secretText: "synthetic-value",
      }),
    /FORBIDDEN/,
  );
});
test("replacement reuses ID, destination, policy and role; appends key version", () => {
  let s = issue();
  const k = structuredClone(s.keys[0]);
  s = change(s, {
    kind: "request",
    templateId: "api-key-replace",
    keyId: k.id,
    requestId: "replace-001",
    input: {
      ...s.documents[0].input,
      endpointIds: ["ep-users"],
      reason: "remove organization access",
    },
  });
  assert.equal(s.documents[1].line.length, 2);
  assert.deepEqual(s.keys[0], k);
  for (const actorId of ["usr-002", "usr-001"])
    s = change(
      { ...s, actorId },
      { kind: "decide", id: "replace-001", decision: "approved" },
    );
  s = change(
    s,
    { kind: "execute", id: "replace-001", secretText: "new-synthetic-value" },
    "new-hash",
  );
  assert.equal(s.keys.length, 1);
  assert.equal(s.keys[0].id, k.id);
  assert.equal(s.keys[0].policyId, k.policyId);
  assert.equal(s.keys[0].roleId, k.roleId);
  assert.equal(s.keys[0].secretKey, k.secretKey);
  assert.equal(s.keys[0].version, 2);
  assert.equal(s.keys[0].history.length, 2);
  assert.equal(s.policies.length, 1);
  assert.equal(s.roles.length, 1);
  assert.deepEqual(s.documents[1].previousEndpointIds, ["ep-users", "ep-orgs"]);
  assert.deepEqual(s.policies[0].endpointIds, ["ep-users"]);
});
test("revocation is two steps and removes dedicated authorization only after execution", () => {
  let s = issue();
  s = change(s, {
    kind: "request",
    templateId: "api-key-revoke",
    keyId: s.keys[0].id,
    requestId: "revoke-001",
    input: { ...s.documents[0].input, reason: "retired" },
  });
  for (const actorId of ["usr-002", "usr-001"])
    s = change(
      { ...s, actorId },
      { kind: "decide", id: "revoke-001", decision: "approved" },
    );
  assert.equal(s.keys[0].status, "active");
  s = change(s, { kind: "execute", id: "revoke-001", secretText: "" });
  assert.equal(s.keys[0].status, "revoked");
  assert.equal(s.keys[0].history.length, 2);
  assert.equal(s.roles.length, 0);
  assert.equal(s.policies.length, 0);
});
test("template updates do not mutate existing snapshots; catalog targets are validated", () => {
  let s = seed();
  const t = structuredClone(s.templates[0]);
  t.name = "Updated";
  s = change(s, { kind: "template", template: t });
  assert.equal(s.templates[0].version, 2);
  assert.notEqual(s.documents[0].template.name, "Updated");
  assert.equal(s.documents[0].template.version, 1);
  const bad = structuredClone(s.templates[0]);
  bad.line[0] = {
    label: "bad",
    kind: "user",
    id: "missing",
    action: "approve",
  };
  assert.throws(
    () => change(s, { kind: "template", template: bad }),
    /INVALID_TARGET/,
  );
});
test("invalid endpoints, duplicate requests and changed destinations are rejected", () => {
  let s = issue();
  const c: Command = {
    kind: "request",
    templateId: "api-key-replace",
    keyId: s.keys[0].id,
    requestId: "replace-001",
    input: { ...s.documents[0].input, reason: "test" },
  };
  assert.throws(
    () => change(s, { ...c, input: { ...c.input, endpointIds: ["ep-roles"] } }),
    /INVALID_ENDPOINT/,
  );
  assert.throws(
    () => change(s, { ...c, input: { ...c.input, secretKey: "another" } }),
    /INVALID_KEY/,
  );
  s = change(s, c);
  assert.throws(
    () => change(s, { ...c, requestId: "replace-002" }),
    /REQUEST_PENDING/,
  );
});
test("rejected approval cannot execute and leaves resources untouched", () => {
  let s = seed();
  s = change(
    { ...s, actorId: "usr-002" },
    { kind: "decide", id: s.documents[0].id, decision: "rejected" },
  );
  assert.equal(s.keys.length, 0);
  assert.throws(
    () =>
      change(
        { ...s, actorId: "usr-001" },
        {
          kind: "execute",
          id: s.documents[0].id,
          secretText: "synthetic-value",
        },
      ),
    /FORBIDDEN/,
  );
});
test("missing hash after failed storage cannot commit provisioned metadata", () => {
  const s = approve(seed());
  assert.throws(
    () =>
      change(
        s,
        {
          kind: "execute",
          id: s.documents[0].id,
          secretText: "synthetic-value",
        },
        "",
      ),
    /INVALID_SECRET/,
  );
  assert.equal(s.keys.length, 0);
  assert.equal(s.documents[0].execution, "ready");
});
test("service-team execution is bound to the request snapshot", () => {
  const s = approve(seed());
  s.services = s.services.map((v) => ({ ...v, teamId: "org-finance" }));
  s.actorId = "usr-013";
  assert.throws(
    () =>
      change(s, {
        kind: "execute",
        id: s.documents[0].id,
        secretText: "synthetic-value",
      }),
    /FORBIDDEN/,
  );
});
test("Secret field ownership cannot be reused by an unrelated pair", () => {
  const s = issue();
  assert.throws(
    () =>
      change(s, {
        kind: "request",
        templateId: "api-key-issue",
        keyId: "",
        requestId: "second-pair-001",
        input: {
          ...s.documents[0].input,
          accountId: "sa-platform-ci",
          reason: "another account",
        },
      }),
    /SECRET_IN_USE/,
  );
});
test("organization viewer access ends with current membership", () => {
  const s = seed();
  s.actorId = "usr-003";
  assert.equal(canRead(s, s.documents[0]), true);
  s.memberships = s.memberships.filter((m) => m.userId !== "usr-003");
  assert.equal(canRead(s, s.documents[0]), false);
});
test("template creation starts v1 and does not permit non-admin edits", () => {
  let s = seed();
  const template = {
    ...structuredClone(s.templates[0]),
    id: "new-template",
    name: "New template",
    version: 0,
  };
  s = change(s, { kind: "template", template });
  assert.equal(s.templates.at(-1)?.version, 1);
  assert.throws(
    () => change({ ...s, actorId: "usr-014" }, { kind: "template", template }),
    /FORBIDDEN/,
  );
});
