import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { screens, viewport, prepare } from "../tools/demo/screens.mjs";
const selected = new Set([
  "ME-01-ACCESS",
  "USR-03-ACCESS",
  "PLT-05-MEMBERS",
  "ROL-05-POLICIES",
  "CHK-01-ALLOW",
  "REQ-01-FORM",
  "SYNC-OUTCOMES",
]);
const browser = await chromium.launch();
const report = [];
try {
  for (const screen of screens.filter((s) => selected.has(s.id))) {
    const contexts = await Promise.all(
      [0, 1].map(() => browser.newContext({ viewport, locale: "ko-KR" })),
    );
    try {
      const pages = await Promise.all(contexts.map((c) => c.newPage()));
      for (const [i, file] of [
        "docs/reviews/2026-09-27-access-ui-user-approved.html",
        "docs/demo/approved.html",
      ].entries())
        await prepare(
          pages[i],
          screen,
          pathToFileURL(path.resolve(file)).href + "#",
        );
      const images = await Promise.all(
        pages.map(async (p) =>
          PNG.sync.read(
            await p.screenshot({
              animations: "disabled",
              fullPage: (await p.getByRole("dialog").count()) === 0,
            }),
          ),
        ),
      );
      const [a, b] = images;
      assert.deepEqual([a.width, a.height], [b.width, b.height]);
      const fraction =
        pixelmatch(a.data, b.data, null, a.width, a.height, {
          threshold: 0.1,
        }) /
        (a.width * a.height);
      assert.ok(fraction <= 0.001, screen.id + ": " + fraction);
      report.push({ screen: screen.id, difference: fraction });
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  "docs/reviews/2026-09-27-access-ui-parity.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
