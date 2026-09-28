import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = pathToFileURL(path.resolve("docs/demo/preview.html")).href + "#";
const dir = "docs/demo/action-layout-review";
await fs.mkdir(dir, { recursive: true });
async function go(route) {
  await page.goto(base + route);
  await page.locator("main h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
try {
  await go("/actions/employee~read-regional-employees");
  const req = page.locator("[data-contract-phase=request]"),
    res = page.locator("[data-contract-phase=response]");
  await req.waitFor();
  let original = JSON.parse(await req.locator("pre").nth(0).innerText()),
    after = JSON.parse(await req.locator("pre").nth(1).innerText());
  assert.equal(original.body.internal_option, false);
  assert.equal("internal_option" in after.body, false);
  assert.deepEqual(after.body.filter.region_codes, ["<scope:sales-region>"]);
  assert.equal(after.body.requester_email, "<subject.email>");
  let response = JSON.parse(await res.locator("pre").nth(1).innerText());
  assert.equal("internal_note" in response.items[0], false);
  assert.notEqual(response.items[0].email_address, "employee@example.test");
  await req.screenshot({ path: dir + "/request-comparison.png" });
  await res.screenshot({ path: dir + "/response-comparison.png" });
  await page
    .locator(".contract-toolbar select")
    .first()
    .selectOption("action/employee/read-regional-contacts");
  response = JSON.parse(await res.locator("pre").nth(1).innerText());
  assert.equal(response.items[0].email_address, "employee@example.test");
  assert.match(await res.innerText(), /원문 반환/);
  assert.match(await res.innerText(), /마스킹 · email/);
  await go("/api-keys");
  await page.getByRole("table", { name: "API 키 목록", exact: true }).waitFor();
  assert.equal(
    await page
      .getByText("기존 API 키 · 결재 스냅샷 이관 필요", { exact: false })
      .count(),
    0,
  );
  assert.ok((await page.locator('tbody a[href*="/api-keys/"]').count()) > 0);
  await page.screenshot({ path: dir + "/api-keys.png", fullPage: true });
  await go("/policies");
  assert.equal(
    await page.getByText("API 키 결재 관리 정책", { exact: true }).count(),
    0,
  );
  await page.getByText("설정·운영", { exact: true }).waitFor();
  await go("/access-check?user=usr-001&platform=orion&action=identity~read-hr");
  await page.getByText("기존 사용자 접근 확인", { exact: true }).click();
  await page.getByRole("button", { name: "접근 확인", exact: true }).click();
  await page.getByText("상세 근거 및 데이터 범위", { exact: true }).click();
  const detail = page
    .locator("details")
    .filter({
      has: page
        .locator("summary")
        .filter({ hasText: "상세 근거 및 데이터 범위" }),
    })
    .last();
  const measurements = await detail.evaluate((d) => {
    const body = d.querySelector(":scope > .ui-disclosure-body"),
      grid = body.querySelector(":scope > .access-grid"),
      next = body.querySelector(":scope > section");
    return {
      gap:
        next.getBoundingClientRect().top - grid.getBoundingClientRect().bottom,
      token: parseFloat(getComputedStyle(body).gap),
      top:
        grid.getBoundingClientRect().top -
        d.querySelector("summary").getBoundingClientRect().bottom,
    };
  });
  assert.equal(measurements.gap, 24);
  assert.equal(measurements.token, 24);
  assert.equal(measurements.top, 24);
  await detail.screenshot({ path: dir + "/access-detail-spacing.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileGap = await detail.locator(".access-grid").evaluate((g) => {
    const c = g.children;
    return (
      c[1].getBoundingClientRect().top - c[0].getBoundingClientRect().bottom
    );
  });
  assert.equal(mobileGap, 24);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await detail.screenshot({ path: dir + "/access-mobile.png" });
  await go("/actions/employee~read-regional-employees");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page
    .locator("[data-contract-phase=request]")
    .screenshot({ path: dir + "/request-mobile.png" });
  assert.deepEqual(errors, []);
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  const files = (await fs.readdir(dir)).filter((n) => n.endsWith(".png"));
  await fs.writeFile(
    dir + "/manifest.json",
    JSON.stringify(
      {
        html: hash(await fs.readFile("docs/demo/preview.html")),
        measurements,
        screens: await Promise.all(
          files.map(async (file) => ({
            file,
            sha256: hash(await fs.readFile(dir + "/" + file)),
          })),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Action shape, injection, exclusion, masking/unmask and logs; unified key list; policy/menu cleanup; desktop/mobile 24px disclosure spacing and overflow checks passed.",
  );
} finally {
  await browser.close();
}
