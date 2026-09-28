import { build } from "esbuild";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const root = "prototype/overrides/src/features/definition-contract";
await build({
  stdin: {
    contents: `export * from './${root}/model.ts';export * from './${root}/policy-model.ts';export {files} from './${root}/fixtures.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: ".policy-draft-test.mjs",
});
try {
  const {
    parseFiles,
    validate,
    files,
    effective,
    subjects,
    initialBindings,
    compatible,
    requirements,
  } = await import("../.policy-draft-test.mjs");
  const defs = parseFiles(files);
  assert.deepEqual(validate(defs), []);
  const manager = subjects[1],
    sa = subjects[2];
  assert.equal(effective(defs, initialBindings[manager.id], manager).length, 2);
  assert.equal(
    effective(
      defs,
      initialBindings[manager.id].filter((b) => b.policy !== "regional-reader"),
      manager,
    ).length,
    2,
  );
  assert.equal(
    effective(
      defs,
      [
        ...initialBindings[manager.id],
        { policy: "deny-regional-contacts", expiresAt: null },
      ],
      manager,
    ).length,
    1,
  );
  assert.equal(
    effective(
      defs,
      [{ policy: "regional-reader", expiresAt: "2020-01-01T00:00:00Z" }],
      manager,
    ).length,
    0,
  );
  assert.equal(
    compatible(
      defs.find((d) => d.id === "regional-reader"),
      sa,
    ),
    false,
  );
  assert.equal(
    compatible(
      defs.find((d) => d.id === "regional-reader"),
      { ...manager, platform: "other" },
    ),
    false,
  );
  assert.equal(effective(defs, initialBindings[sa.id], sa).length, 1);
  assert.equal(
    requirements(defs, "employee.read-regional-contacts", sa).length,
    1,
  );
  assert.equal(
    requirements(defs, "employee.read-service-employees", sa).length,
    0,
  );
  const broken = structuredClone(defs);
  broken.find((d) => d.id === "regional-reader").data.assignable_to =
    "service_account";
  assert.ok(validate(broken).some((e) => e.includes("화면 조건")));
  const badPage = structuredClone(defs);
  badPage.find((d) => d.id === "regional-reader").data.workspaces[
    "sales-platform.sales-console"
  ].pages["regional-employees"].actions = ["employee.read-service-employees"];
  assert.ok(validate(badPage).some((e) => e.includes("페이지 미등록")));
  const directDeny = {
    key: "policy/deny-all",
    kind: "policy",
    id: "deny-all",
    parent: "",
    file: "test",
    name: "deny",
    refs: [],
    data: {
      assignable_to: "role",
      effect: "deny",
      actions: ["employee.read-regional-employees"],
    },
  };
  assert.equal(
    effective(
      [...defs, directDeny],
      [...initialBindings[manager.id], { policy: "deny-all", expiresAt: null }],
      manager,
    ).length,
    1,
  );
  console.log(
    "12 policy checks passed: references, union, retained grants, scoped/global deny, expiry, subject/platform mismatch and injection requirements.",
  );
} finally {
  await fs.rm(".policy-draft-test.mjs", { force: true });
}
