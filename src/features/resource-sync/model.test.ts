import test from "node:test";
import assert from "node:assert/strict";
import { stringify } from "yaml";
import {
  parseBundle,
  diff,
  applySnapshot,
  type Snapshot,
  type Item,
} from "./model.ts";
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
    autoSync: "disabled",
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
test("parents, automatic sync and cloud readiness block apply", () => {
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
  s.autoSync = "enabled";
  s.cloudConfig = "pending";
  assert.equal(diff(s).blockers.length, 3);
});
test("update is idempotent in diff and preserves stable id", () => {
  const s = snapshot([{ ...item, name: "Renamed" }]);
  assert.equal(diff(s).rows[0].operation, "update");
  const next = applySnapshot(s);
  assert.equal(next.resources[0].id, item.id);
  const after = { ...s, dbRevision: next.revision, graph: next };
  assert.equal(diff(after).rows[0].operation, "unchanged");
});
