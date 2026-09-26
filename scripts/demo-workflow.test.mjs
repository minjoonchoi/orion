import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const tool = path.resolve("scripts/demo-workflow.mjs");
test("draft changes cannot be applied or approved without a reviewed revision", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "orion-gate-test-"));
  try {
    await fs.mkdir(path.join(dir, "src"));
    await fs.writeFile(path.join(dir, "src/example.ts"), "original");
    const run = (...args) =>
      spawnSync(process.execPath, [tool, ...args], {
        cwd: dir,
        encoding: "utf8",
      });
    assert.equal(run("begin").status, 0);
    assert.notEqual(run("apply").status, 0);
    assert.notEqual(
      run("approve", "TEST confirmation cannot approve an unreviewed draft")
        .status,
      0,
    );
    assert.notEqual(run("check").status, 0);
    assert.equal(
      await fs.readFile(path.join(dir, "src/example.ts"), "utf8"),
      "original",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
