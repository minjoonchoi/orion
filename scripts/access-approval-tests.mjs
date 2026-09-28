import { build } from "esbuild";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "orion-access-test-"));
await fs.cp("src", path.join(temp, "src"), { recursive: true });
await fs.cp("prototype/overrides/src", path.join(temp, "src"), {
  recursive: true,
});
await build({
  stdin: {
    contents: `export * from './src/features/approval-workflow/model.ts';export * from './src/features/approval-workflow/access.ts';export {seed} from './src/features/approval-workflow/demo.ts';export {demoDirectory} from './src/features/platforms/demo.ts';`,
    resolveDir: temp,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".access-approval-test.mjs",
});
try {
  const { apply, seed, demoDirectory, activeAccess, publicState, stateSchema } =
    await import("../.access-approval-test.mjs");
  const now = "2026-09-28T08:00:00Z",
    directory = demoDirectory();
  const command = {
    kind: "access-request",
    requestId: "access-test-001",
    platformId: "orion",
    roleId: "role-security",
    reason: "보안 검토",
    expiresAt: "2026-12-31",
  };
  const run = (s, c, d = directory, time = now) =>
    apply(s, c, s.revision, time, "", d);
  const s = run(seed(), command);
  const doc = s.documents.at(-1);
  assert.equal(doc.template.type, "access");
  assert.equal(doc.execution, "waiting");
  assert.equal(activeAccess(s).length, 0);
  assert.equal(run(s, command).documents.length, s.documents.length);
  assert.throws(
    () => run(s, { ...command, requestId: "access-test-002" }),
    /REQUEST_PENDING/,
  );
  assert.throws(() => run(s, { ...command, reason: "other" }), /CONFLICT/);
  assert.throws(
    () => run(seed(), { ...command, roleId: "role-platform" }),
    /ALREADY_GRANTED/,
  );
  assert.throws(
    () => run(seed(), { ...command, platformId: "finance" }),
    /INVALID_TARGET/,
  );
  assert.throws(
    () => run({ ...seed(), actorId: "usr-006" }, command),
    /MEMBERSHIP_REQUIRED/,
  );
  assert.throws(
    () => run(seed(), { ...command, expiresAt: "2026-09-01" }),
    /INVALID_EXPIRY/,
  );
  assert.throws(
    () => run(s, { kind: "execute", id: doc.id, secretText: "" }),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      apply(s, { kind: "decide", id: doc.id, decision: "approved" }, 0, now),
    /REVISION_CONFLICT/,
  );
  let approved = run(
    { ...s, actorId: "usr-002" },
    { kind: "decide", id: doc.id, decision: "approved" },
  );
  assert.equal(approved.documents.at(-1).status, "pending");
  // Even if an organization membership matches, a requester cannot approve themselves.
  const self = structuredClone(approved);
  self.actorId = "usr-001";
  self.memberships.push({ userId: "usr-001", organizationId: "org-security" });
  assert.throws(
    () => run(self, { kind: "decide", id: doc.id, decision: "approved" }),
    /FORBIDDEN/,
  );
  approved = run(
    { ...approved, actorId: "usr-003" },
    { kind: "decide", id: doc.id, decision: "approved" },
  );
  assert.equal(approved.documents.at(-1).execution, "ready");
  assert.equal(activeAccess(approved).length, 0);
  const changed = structuredClone(directory);
  changed.roles
    .find((r) => r.id === "role-security")
    .policyIds.push("policy-directory");
  assert.throws(
    () =>
      run(approved, { kind: "execute", id: doc.id, secretText: "" }, changed),
    /ACCESS_CHANGED/,
  );
  const suspended = structuredClone(directory);
  suspended.members.find(
    (m) => m.userId === "usr-001" && m.platformId === "orion",
  ).status = "suspended";
  assert.throws(
    () =>
      run(approved, { kind: "execute", id: doc.id, secretText: "" }, suspended),
    /MEMBERSHIP_REQUIRED/,
  );
  assert.throws(
    () =>
      run(
        approved,
        { kind: "execute", id: doc.id, secretText: "" },
        directory,
        "2027-01-01T00:00:00Z",
      ),
    /INVALID_EXPIRY/,
  );
  const cancelledReady = run(
    { ...approved, actorId: "usr-001" },
    { kind: "cancel", id: doc.id },
  );
  assert.equal(cancelledReady.documents.at(-1).status, "cancelled");
  assert.equal(
    run(cancelledReady, {
      ...command,
      requestId: "access-test-003",
    }).documents.at(-1).status,
    "pending",
  );
  const completed = run(approved, {
    kind: "execute",
    id: doc.id,
    secretText: "",
  });
  assert.equal(activeAccess(completed, now).length, 1);
  assert.equal(activeAccess(completed, "2027-01-01T00:00:00Z").length, 0);
  assert.equal(completed.keys.length, approved.keys.length);
  assert.equal(completed.roles.length, approved.roles.length);
  assert.throws(
    () => run(completed, { kind: "execute", id: doc.id, secretText: "" }),
    /FORBIDDEN/,
  );
  const rejected = run(
    { ...s, actorId: "usr-002" },
    { kind: "decide", id: doc.id, decision: "rejected" },
  );
  assert.equal(rejected.documents.at(-1).status, "rejected");
  assert.equal(activeAccess(rejected).length, 0);
  const cancelled = run(s, { kind: "cancel", id: doc.id });
  assert.equal(cancelled.documents.at(-1).status, "cancelled");
  assert.throws(
    () =>
      run(
        { ...cancelled, actorId: "usr-002" },
        { kind: "decide", id: doc.id, decision: "approved" },
      ),
    /INVALID_STATE/,
  );
  assert.throws(
    () => run({ ...s, actorId: "usr-002" }, { kind: "cancel", id: doc.id }),
    /FORBIDDEN/,
  );
  assert.equal(
    publicState({ ...s, actorId: "usr-012" }).documents.some(
      (d) => d.id === doc.id,
    ),
    false,
  );
  assert.equal(
    stateSchema.parse(completed).documents.at(-1).access.roleId,
    "role-security",
  );
  console.log(
    "Access approval: request, idempotency, duplicates, ACL, self-approval, rejection, cancellation, revision, expiry, membership, role changes, provisioning and isolation passed.",
  );
} finally {
  await fs.rm(".access-approval-test.mjs", { force: true });
  await fs.rm(temp, { recursive: true, force: true });
}
