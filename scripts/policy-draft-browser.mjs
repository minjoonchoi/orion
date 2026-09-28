import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
const base = pathToFileURL(path.resolve("docs/demo/preview.html")).href + "#";
const out = "docs/demo/policy-review";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function go(route) {
  await page.goto(base + route);
  await page.locator("main h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
try {
  await go("/policies");
  await page
    .getByRole("link", {
      name: "직원 연락처 조회 regional-contact-reader",
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: out + "/policies.png", fullPage: true });
  await go("/policies/service-employee-reader");
  await page
    .getByRole("heading", { name: "직접 실행 액션", exact: true })
    .waitFor();
  await page.screenshot({ path: out + "/service-policy.png", fullPage: true });
  await go("/roles/role-sales-manager");
  await page.getByRole("button", { name: "정책 변경", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "직원 기본 조회", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "변경 검토", exact: true }).click();
  const dialog = page.getByRole("dialog");
  assert.match(await dialog.innerText(), /유지\s*2/);
  assert.match(await dialog.innerText(), /제거\s*0/);
  await page.screenshot({ path: out + "/role-review.png", fullPage: true });
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "정책 부여 변경을 반영했습니다." })
    .waitFor();
  await go("/service-accounts/sa-platform-ci?tab=policies");
  await page.getByRole("button", { name: "정책 변경", exact: true }).click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "직원 기본 조회", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("checkbox", {
      name: "서비스 연락처 조회 · 사용자 속성 필요",
      exact: true,
    })
    .check();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "변경 검토", exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({
    path: out + "/account-validation.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.screenshot({
    path: out + "/account-policies.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/policies");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: out + "/mobile.png", fullPage: true });
  const a11y = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(
    a11y.violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => v.id),
    [],
  );
  const language = page.locator("header select").first();
  await language.selectOption("en");
  await page
    .getByRole("heading", { name: "Policies", exact: true })
    .first()
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: out + "/english-mobile.png", fullPage: true });
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  const images = await fs.readdir(out);
  const manifest = {
    html: hash(await fs.readFile("docs/demo/preview.html")),
    screens: await Promise.all(
      images
        .filter((n) => n.endsWith(".png"))
        .map(async (file) => ({
          file,
          sha256: hash(await fs.readFile(out + "/" + file)),
        })),
    ),
  };
  await fs.writeFile(
    out + "/manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: independent policies, retained grant review/apply, account type filter, missing source block, mobile width, no runtime errors.",
  );
} finally {
  await browser.close();
}
