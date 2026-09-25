import { test } from "node:test";
import assert from "node:assert/strict";
import { yamlDiff, yamlLines } from "./yaml-diff.ts";
test("YAML diff reconstructs both definitions including nested processors", () => {
  const before = {
    id: "p",
    processors: { post: [{ field: "name", mode: "keep" }] },
  };
  const after = {
    id: "p",
    processors: { post: [{ field: "email", mode: "remove" }] },
  };
  const lines = yamlDiff(before, after);
  assert.deepEqual(
    lines.filter((l) => l.type !== "add").map((l) => l.text),
    yamlLines(before),
  );
  assert.deepEqual(
    lines.filter((l) => l.type !== "remove").map((l) => l.text),
    yamlLines(after),
  );
  assert.ok(lines.some((l) => l.type === "remove" && l.text.includes("name")));
});
test("canonical keys avoid false changes and new/deleted definitions retain lines", () => {
  assert.ok(
    yamlDiff({ b: 2, a: 1 }, { a: 1, b: 2 }).every((l) => l.type === "same"),
  );
  assert.ok(yamlDiff(null, { id: "new" }).every((l) => l.type === "add"));
  assert.ok(yamlDiff({ id: "old" }, null).every((l) => l.type === "remove"));
});
