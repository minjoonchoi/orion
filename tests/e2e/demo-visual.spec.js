import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { screens, viewport, prepare } from "../../tools/demo/screens.mjs";
const approved = fs.existsSync("docs/demo/approved.html")
  ? "docs/demo/approved.html"
  : "docs/demo/orion.html";
for (const screen of screens.filter((s) =>
  [
    "USR-01",
    "USR-02",
    "ORG-02",
    "POL-02",
    "APR-01",
    "APR-02",
    "APR-03",
    "TPL-01",
    "TPL-03",
    "TPL-04",
    "KEY-03",
    "KEY-03-REVIEW",
    "SYNC-REVIEW",
    "SYNC-IMPACT",
  ].includes(s.id),
)) {
  test(`product matches reviewed HTML visually: ${screen.id}`, async ({
    browser,
  }) => {
    const contexts = await Promise.all([
      browser.newContext({ viewport, locale: "ko-KR" }),
      browser.newContext({ viewport, locale: "ko-KR" }),
    ]);
    try {
      const pages = await Promise.all(contexts.map((c) => c.newPage()));
      await prepare(pages[0], screen, "http://127.0.0.1:3100");
      await prepare(
        pages[1],
        screen,
        pathToFileURL(path.resolve(approved)).href + "#",
      );
      await expect(pages[1].locator("main h1")).toHaveText(
        await pages[0].locator("main h1").innerText(),
      );
      const captures = await Promise.all(
        pages.map((p) =>
          p.screenshot({ animations: "disabled", fullPage: !screen.action }),
        ),
      );
      const [a, b] = captures.map((p) => PNG.sync.read(p));
      expect([a.width, a.height]).toEqual([b.width, b.height]);
      const diff = new PNG({ width: a.width, height: a.height });
      const count = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: 0.1,
      });
      if (count / (a.width * a.height) > 0.001) {
        await test
          .info()
          .attach("product", { body: captures[0], contentType: "image/png" });
        await test.info().attach("reviewed-html", {
          body: captures[1],
          contentType: "image/png",
        });
        await test.info().attach("difference", {
          body: PNG.sync.write(diff),
          contentType: "image/png",
        });
      }
      expect(count / (a.width * a.height)).toBeLessThanOrEqual(0.001);
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
}
