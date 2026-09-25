import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stringify } from "yaml";
import { parseBundle, currentPolicy } from "./model.ts";

const source = readFileSync(
  new URL("../../../config/policies/orion-policies.yaml", import.meta.url),
  "utf8",
);
const parse = (yaml: string) =>
  parseBundle(yaml, "development", "ap-northeast-2");

test("processors require an explicitly linked endpoint and matching phase", () => {
  for (const mutation of ["endpoint", "phase", "deny"] as const) {
    const bundle = parse(source);
    const policy = bundle.spec.policies[0];
    if (mutation === "endpoint")
      policy.processors.pre[0].endpointId = "svc-orion";
    if (mutation === "phase") policy.processors.pre[0].target = "response.body";
    if (mutation === "deny") policy.effect = "deny";
    assert.throws(() => parse(stringify(bundle)), /INVALID_PROCESSOR/);
  }
});

test("non-endpoint policies need no processing and endpoint settings survive projection", () => {
  const bundle = parse(source);
  const policy = bundle.spec.policies[0];
  const projected = currentPolicy({
    ...policy,
    definitionVersion: policy.version,
    processors: [
      ...policy.processors.pre.map((p) => ({ ...p, phase: "pre" as const })),
      ...policy.processors.post.map((p) => ({ ...p, phase: "post" as const })),
    ],
  });
  assert.deepEqual(projected, policy);
  policy.resources = [{ kind: "pages", id: "page-users" }];
  policy.processors = { pre: [], post: [] };
  assert.doesNotThrow(() => parse(stringify(bundle)));
});
