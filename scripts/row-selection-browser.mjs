import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = pathToFileURL(path.resolve("docs/demo/preview.html")).href + "#";
try {
  await page.goto(base + "/platforms/orion?tab=members");
  const table = page.getByRole("table", {
    name: "플랫폼 멤버 관리",
    exact: true,
  });
  await table.waitFor();
  const row = table.locator("tbody tr").first(),
    box = row.getByRole("checkbox");
  const padding = row.locator("td").first();
  assert.equal(await box.isChecked(), false);
  await padding.click({ position: { x: 3, y: 3 } });
  assert.equal(await box.isChecked(), true);
  assert.equal(
    await table
      .locator("thead input[type=checkbox]")
      .evaluate((e) => e.indeterminate),
    true,
  );
  await padding.click({ position: { x: 3, y: 3 } });
  assert.equal(await box.isChecked(), false);
  await box.check();
  assert.equal(await box.isChecked(), true);
  await box.uncheck();
  assert.equal(await box.isChecked(), false);
  await box.focus();
  await page.keyboard.press("Space");
  assert.equal(await box.isChecked(), true);
  await page.keyboard.press("Space");
  assert.equal(await box.isChecked(), false);
  await box.evaluate((e) => (e.disabled = true));
  await padding.click({ position: { x: 3, y: 3 } });
  assert.equal(await box.isChecked(), false);
  await box.evaluate((e) => (e.disabled = false));
  await row.evaluate((r) => {
    const t = r.querySelector("td:nth-child(2)");
    const range = document.createRange();
    range.selectNodeContents(t);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    r.click();
  });
  assert.equal(await box.isChecked(), false);
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await table.evaluate((t) => {
    window.rowChanges = 0;
    t.addEventListener("change", () => window.rowChanges++);
  });
  await row.getByRole("link").first().click();
  assert.equal(await page.evaluate(() => window.rowChanges), 0);
  await page.goto(base + "/definition-sync");
  const syncRow = page.locator("tr[data-selectable-row]").first();
  await syncRow.waitFor();
  const syncBox = syncRow.getByRole("checkbox");
  const before = await syncBox.isChecked();
  await syncRow
    .locator("td")
    .first()
    .click({ position: { x: 3, y: 3 } });
  assert.equal(await syncBox.isChecked(), !before);
  await page.goto(base + "/policies");
  await page
    .getByRole("heading", { name: "정책", exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page
      .getByRole("table", { name: "정책 목록", exact: true })
      .locator("tr[data-selectable-row]")
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Row selection passed: row toggle, checkbox single toggle, header mixed state, keyboard Space, disabled checkbox, text selection, link independence, native Sync table, non-selectable table.",
  );
} finally {
  await browser.close();
}
