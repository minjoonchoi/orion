import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseSources,
  parseEntities,
  validateCatalog,
  makePlan,
  key,
  fields,
  evaluate,
  object,
  dependentPolicies,
  subjects,
  changed,
  type Entity,
} from "./model.ts";
import type { Graph } from "../authorization/model.ts";
const source = readFileSync(
  new URL("../../../config/definitions/platform.yaml", import.meta.url),
  "utf8",
);
const graph: Graph = {
  revision: 0,
  users: [{ id: "u", name: "User" }],
  organizations: [{ id: "o", name: "Org", memberIds: ["member"] }],
  serviceAccounts: [
    { id: "sa", name: "Robot", organizationId: "o", roleIds: ["r"] },
  ],
  roles: [
    {
      id: "r",
      name: "Role",
      description: "",
      userIds: ["u"],
      organizationIds: ["o"],
      bindings: [{ policyId: "policy-platform", expiresAt: null }],
    },
  ],
  resources: [],
  policies: [],
};
const all = () => parseSources([source]);
const policy = (entities: Entity[], id = "policy-platform") =>
  entities.find((e) => e.kind === "policies" && e.id === id)!;
test("new YAML parses nested scoped IDs, duplicate endpoint paths and local fields", () => {
  const es = all();
  assert.deepEqual(validateCatalog(es), []);
  assert.equal(
    es.filter((e) => e.kind === "service-endpoints" && e.id === "detail")
      .length,
    2,
  );
  assert.ok(
    fields(
      es.find(
        (e) => e.key === key("service-endpoints", "detail", "directory-api"),
      )!,
      "response",
    ).email,
  );
  assert.deepEqual(parseEntities(es), es);
});
test("duplicate scoped definitions, malformed refs, environment wrappers and aliases are rejected", () => {
  assert.throws(() => parseSources([source, source]));
  assert.throws(() =>
    parseSources([
      source.replace(
        "name: 플랫폼 운영",
        "environment: production\n  name: 플랫폼 운영",
      ),
    ]),
  );
  assert.throws(() =>
    parseSources([
      source.replace(
        "ref: { service: identity-api, endpoint: detail }",
        "ref: { endpoint: detail }",
      ),
    ]),
  );
  assert.throws(() =>
    parseSources(["workspace: &a {id: test, name: test, pages: [*a]}"]),
  );
});
test("policy field references resolve through exact domain/action/service/endpoint", () => {
  const es = all(),
    p = policy(es);
  const g = (
    object(p.definition.resources).actions as Record<string, unknown>[]
  )[0];
  object(g.ref).action = "directory-sync";
  assert.ok(
    validateCatalog(es).some((e) => e.includes("PAGE_ACTION_MISMATCH")),
  );
  assert.ok(validateCatalog(es).some((e) => e.includes("UNKNOWN_FIELD")));
});
test("policy sync includes its action endpoint parents but no sibling endpoint", () => {
  const es = all();
  const p = makePlan({ applied: [], desired: es, graph }, [
    "policies:policy-platform",
  ]);
  assert.deepEqual(p.blockers, []);
  assert.ok(p.keys.includes("service-endpoints:identity-api/detail"));
  assert.ok(!p.keys.includes("service-endpoints:directory-api/detail"));
  assert.ok(!p.keys.includes("actions:identity/read-summary"));
  assert.equal(p.changes.length, p.keys.length);
});
test("field deletion blocks sync when another applied policy still references it", () => {
  const applied = all(),
    desired = all();
  delete fields(
    desired.find((e) => e.key === "service-endpoints:identity-api/detail")!,
    "response",
  ).email;
  const p = makePlan({ applied, desired, graph }, [
    "service-endpoints:identity-api/detail",
  ]);
  assert.ok(p.blockers.some((e) => e.includes("UNKNOWN_FIELD")));
});
test("unmask-only cannot grant call or reveal an unselected field; actions stay isolated", () => {
  const es = all(),
    p = policy(es),
    u = policy(es, "email-unmask");
  assert.equal(evaluate(es, [u], "actions:identity/read-hr").allowed, false);
  assert.equal(
    evaluate(es, [p, u], "actions:identity/read-hr").rows.find(
      (r) => r.field === "email",
    )!.mode,
    "unmask",
  );
  assert.equal(
    evaluate(es, [p, u], "actions:identity/read-summary").allowed,
    false,
  );
  const fieldsList = object(
    (object(p.definition.resources).actions as Record<string, unknown>[])[0]
      .response,
  ).fields as Record<string, unknown>[];
  fieldsList.splice(
    fieldsList.findIndex((f) => object(f.ref).field === "email"),
    1,
  );
  assert.equal(
    evaluate(es, [p, u], "actions:identity/read-hr").rows.find(
      (r) => r.field === "email",
    )!.mode,
    "excluded",
  );
});
test("deny overrides unmask; incompatible masks fail closed", () => {
  const es = all(),
    p = policy(es),
    q = structuredClone(p);
  q.id = "second";
  q.key = "policies:second";
  q.definition.id = "second";
  q.definition.effect = "deny";
  assert.equal(
    evaluate(es, [p, q, policy(es, "email-unmask")], "actions:identity/read-hr")
      .reason,
    "deny",
  );
  q.definition.effect = "allow";
  const rs = object(
    (object(q.definition.resources).actions as Record<string, unknown>[])[0]
      .response,
  ).fields as Record<string, unknown>[];
  rs.find((f) => object(f.ref).field === "email")!.masking = {
    method: "keep-last",
    count: 4,
  };
  const r = evaluate(es, [p, q], "actions:identity/read-hr");
  assert.equal(r.allowed, false);
  assert.deepEqual(r.conflicts, ["email"]);
});
test("impact follows endpoint dependencies and excludes organization members", () => {
  const es = all();
  const ps = dependentPolicies(es, ["service-endpoints:identity-api/detail"]);
  assert.ok(ps.some((p) => p.id === "policy-platform"));
  assert.ok(!ps.some((p) => p.id === "directory-integration"));
  assert.deepEqual(
    subjects(graph, ps)
      .map((s) => s.id)
      .sort(),
    ["o", "sa", "u"],
  );
});
test("rollback only restores selected definition and checks dependent references", () => {
  const es = all(),
    p = policy(es),
    old = structuredClone(p);
  old.definition.name = "Previous";
  old.name = "Previous";
  const plan = makePlan(
    { applied: es, desired: es, graph },
    [p.key],
    old,
    p.key,
  );
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.after.find((e) => e.key === p.key)!.name, "Previous");
  assert.equal(
    changed(
      plan.before.find((e) => e.key === "actions:identity/read-hr"),
      plan.after.find((e) => e.key === "actions:identity/read-hr"),
    ),
    false,
  );
  const remove = makePlan(
    { applied: es, desired: es, graph },
    [p.key],
    null,
    p.key,
  );
  assert.ok(remove.blockers.some((b) => b.includes("POLICY_ASSIGNED")));
});
