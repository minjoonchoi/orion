import test from "node:test";
import assert from "node:assert/strict";
import { stringify } from "yaml";
import {
  parseBundle,
  diff,
  applySnapshot,
  type Snapshot,
  type Item,
  resourceChanges,
  historyForResource,
  type Run,
} from "./model.ts";
import { restoreResource } from "./restore.ts";
const item: Item = {
  id: "svc-test",
  kind: "services",
  state: "present",
  name: "Test",
  description: "",
  path: "",
  method: "",
  parentId: "",
};
function snapshot(items: Item[]): Snapshot {
  return {
    dbRevision: 1,
    appliedCommit: "old",
    candidateCommit: "new",
    digest: "hash",
    environment: "test",
    region: "local",
    cloudConfig: "ready",
    yaml: stringify({
      apiVersion: "orion.io/v1alpha1",
      kind: "ResourceBundle",
      metadata: { name: "test", environment: "test", region: "local" },
      spec: { resources: items },
    }),
    graph: {
      revision: 1,
      users: [],
      organizations: [],
      roles: [],
      policies: [],
      resources: [{ ...item }],
    },
  };
}
test("YAML rejects wrong scope, aliases, unknown keys and duplicate IDs", () => {
  const s = snapshot([item]);
  assert.throws(() => parseBundle(s.yaml, "prod", "local"));
  assert.throws(() =>
    parseBundle(snapshot([item, item]).yaml, "test", "local"),
  );
  assert.throws(() =>
    parseBundle(s.yaml.replace("name: Test", "typo: Test"), "test", "local"),
  );
  assert.throws(() => parseBundle("a: &a [*a]", "test", "local"));
});
test("omission retains resources; explicit absent deletes and changes revision", () => {
  const empty = snapshot([]);
  assert.equal(applySnapshot(empty).resources.length, 1);
  const s = snapshot([{ ...item, state: "absent" }]);
  assert.equal(diff(s).rows[0].operation, "delete");
  assert.equal(applySnapshot(s).resources.length, 0);
  assert.equal(applySnapshot(s).revision, 2);
});
test("policy references block delete atomically", () => {
  const s = snapshot([{ ...item, state: "absent" }]);
  s.graph.policies = [
    {
      id: "p",
      name: "p",
      description: "",
      effect: "allow",
      resources: [{ kind: "services", id: item.id }],
    },
  ];
  assert.match(diff(s).blockers[0], /POLICY_REFERENCE/);
  assert.throws(() => applySnapshot(s));
  assert.equal(s.graph.resources.length, 1);
});
test("parents and cloud readiness block apply", () => {
  const s = snapshot([
    {
      ...item,
      id: "ep",
      kind: "service-endpoints",
      path: "/api",
      method: "GET",
      parentId: "missing",
    },
  ]);
  assert.match(diff(s).blockers[0], /PARENT_REFERENCE/);
  s.cloudConfig = "pending";
  assert.equal(diff(s).blockers.length, 2);
});
test("update is idempotent in diff and preserves stable id", () => {
  const s = snapshot([{ ...item, name: "Renamed" }]);
  assert.equal(diff(s).rows[0].operation, "update");
  const next = applySnapshot(s);
  assert.equal(next.resources[0].id, item.id);
  const after = { ...s, dbRevision: next.revision, graph: next };
  assert.equal(diff(after).rows[0].operation, "unchanged");
});
test("history records only changed resources and scopes by both kind and id", () => {
  const s = snapshot([{ ...item, name: "Renamed" }]);
  s.graph.resources.push({ ...item, id: "unchanged" });
  const changes = resourceChanges(s.graph, applySnapshot(s));
  assert.equal(changes.length, 1);
  const run: Run = {
    id: "run",
    status: "succeeded",
    phase: "database",
    message: "",
    commit: "git",
    dbRevision: 2,
    completedAt: undefined,
    rollbackOf: undefined,
    targetRevision: undefined,
    resources: changes,
  };
  assert.equal(historyForResource([run], "services", item.id).length, 1);
  assert.equal(historyForResource([run], "pages", item.id).length, 0);
  assert.equal(historyForResource([run], "services", "unchanged").length, 0);
  assert.equal(
    historyForResource([{ ...run, resources: undefined }], "services", item.id)
      .length,
    0,
  );
});
test("resource rollback preserves unrelated definitions and current grants; references block deletion", () => {
  const s = snapshot([{ ...item, name: "Renamed" }]);
  const current = applySnapshot(s);
  current.resources.push({ ...item, id: "other", name: "Keep current" });
  const restored = restoreResource(current, s.graph, "services", item.id);
  assert.equal(restored.resources.find((r) => r.id === item.id)?.name, "Test");
  assert.equal(
    restored.resources.find((r) => r.id === "other")?.name,
    "Keep current",
  );
  assert.equal(resourceChanges(current, restored).length, 1);
  assert.equal(restored.roles, current.roles);
  current.policies.push({
    id: "policy",
    name: "Policy",
    description: "",
    effect: "allow",
    resources: [{ kind: "services", id: item.id }],
  });
  assert.throws(
    () =>
      restoreResource(
        current,
        { ...current, resources: [] },
        "services",
        item.id,
      ),
    /BLOCKED/,
  );
});
