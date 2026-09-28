import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFiles,
  validate,
  makePlan,
  affected,
  mask,
  obj,
  rules,
} from "../src/features/definition-contract/model.ts";
import { files } from "../src/features/definition-contract/fixtures.ts";
const load = () => parseFiles(files);
const edit = (fragment, replacement) => ({
  ...files,
  "domains/employee.yaml": files["domains/employee.yaml"].replace(
    fragment,
    replacement,
  ),
});
test("service endpoint files join without using file order", () => {
  const a = load();
  const b = parseFiles(Object.fromEntries(Object.entries(files).reverse()));
  assert.equal(a.length, 24);
  assert.deepEqual(validate(a), []);
  assert.deepEqual(a.map((x) => x.key).sort(), b.map((x) => x.key).sort());
});
test("duplicate endpoint and duplicate YAML keys are rejected", () => {
  assert.throws(() =>
    parseFiles({
      ...files,
      "duplicate.yaml":
        files["services/identity-team/employee-api/endpoints/health.yaml"],
    }),
  );
  assert.throws(() =>
    parseFiles({ "bad.yaml": "organization:\n  id: a\n  id: b\n" }),
  );
});
test("missing mandatory request field blocks contract", () => {
  const d = parseFiles(
    edit("            - region_codes: { scope: sales-region }", ""),
  );
  assert.ok(validate(d).some((e) => e.includes("필수 요청 누락")));
});
test("unknown source, duplicate fields and casing mismatch are rejected", () => {
  for (const [a, b, expected] of [
    ["subject.email", "subject.password", "source"],
    [
      "            - keyword",
      "            - keyword\n            - keyword",
      "중복",
    ],
    ["            - employee_name", "            - employeeName", "필드 없음"],
  ])
    assert.ok(
      validate(parseFiles(edit(a, b))).some((e) => e.includes(expected)),
    );
});
test("organization mapping must reference existing codes and organizations", () => {
  assert.ok(
    validate(
      parseFiles(edit("codes: [SEOUL, BUSAN]", "codes: [UNKNOWN]")),
    ).some((e) => e.includes("코드 없음")),
  );
  assert.ok(
    validate(
      parseFiles(edit("organization: sales-team-1", "organization: missing")),
    ).some((e) => e.includes("참조 없음")),
  );
});
test("organization hierarchy cycles are blocked", () => {
  const d = load();
  const o = d.find((x) => x.key === "organization/sales");
  o.data.parent = "sales-team-1";
  assert.ok(validate(d).some((e) => e.includes("순환")));
});
test("Action contracts remain separate for the same endpoint", () => {
  const a = load().filter((x) => x.kind === "action");
  assert.equal(
    obj(a[0].data.endpoint).endpoint,
    obj(a[1].data.endpoint).endpoint,
  );
  assert.equal(
    rules(obj(obj(a[0].data.endpoint).response).fields).find(
      ([f]) => f === "email_address",
    )[1].unmask,
    undefined,
  );
  assert.equal(
    rules(obj(obj(a[1].data.endpoint).response).fields).find(
      ([f]) => f === "email_address",
    )[1].unmask,
    true,
  );
});
test("selected scope includes dependencies and affects all Actions, independent policies and page", () => {
  const desired = load();
  const applied = parseFiles(
    edit("codes: [SEOUL, BUSAN]", "codes: [SEOUL, GYEONGGI]"),
  );
  const plan = makePlan(applied, desired, ["scope/employee/sales-region"]);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.changes.length, 1);
  assert.ok(plan.keys.includes("organization/sales-team-1"));
  assert.equal(
    affected(
      desired,
      plan.changes.map((x) => x.key),
    ).length,
    10,
  );
  assert.deepEqual(
    obj(applied.find((x) => x.kind === "scope").data.organizations[0]).codes,
    ["SEOUL", "GYEONGGI"],
  );
});
test("invalid candidate never mutates applied definitions", () => {
  const a = load();
  const before = JSON.stringify(a);
  const d = parseFiles(edit("codes: [SEOUL, BUSAN]", "codes: [UNKNOWN]"));
  const p = makePlan(a, d, ["scope/employee/sales-region"]);
  assert.ok(p.errors.length);
  assert.equal(JSON.stringify(a), before);
});
test("mask examples, short input, invalid email and graphemes are protected", () => {
  const d = load();
  const rule = (id) => d.find((x) => x.key === `masking/${id}`).data;
  assert.equal(mask("minjoon@example.com", rule("email")), "m***@example.com");
  assert.equal(mask("a@example.com", rule("email")), "[REDACTED]");
  assert.equal(mask("invalid", rule("email")), "[REDACTED]");
  assert.equal(mask("김민준", rule("name")), "김**");
  assert.equal(mask("👨‍👩‍👧‍👦가나다", rule("name")), "👨‍👩‍👧‍👦**");
});
test("privacy rules require compatible field types and valid masking options", () => {
  const d = load();
  d.find((x) => x.key === "masking/email").data["replacement-length"] = -1;
  assert.ok(validate(d).some((e) => e.includes("길이")));
});
