import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const base =
  pathToFileURL(path.resolve("docs/demo/preview.html")).href +
  "#/definition-contract";
const report = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: "ko-KR",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "정의와 실행 계약", exact: true })
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    (await page
      .getByText("마스킹 · email", { exact: true })
      .filter({ visible: true })
      .count()) > 0,
    true,
  );
  await page
    .getByRole("combobox", { name: /업무 Action/ })
    .selectOption("action/employee/read-regional-contacts");
  assert.equal(
    await page
      .getByText("원문 반환", { exact: true })
      .filter({ visible: true })
      .count(),
    2,
  );
  report.push("Action selection preserves separate response contracts");
  await page.getByRole("tab", { name: "GitOps 동기화", exact: true }).click();
  await page.getByRole("button", { name: /동기화 검토/ }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page
      .getByText("Out of sync", { exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  report.push("Cancel leaves applied snapshot unchanged");
  await page.getByRole("button", { name: /동기화 검토/ }).click();
  await page
    .getByRole("button", { name: "변경사항 검토", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "동기화 적용", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("dialog")
      .getByText("SEOUL, GYEONGGI", { exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("dialog")
      .getByText("SEOUL, BUSAN", { exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  await page
    .getByRole("checkbox", {
      name: "변경사항과 조회 범위 영향을 확인했습니다.",
    })
    .check();
  await page.getByRole("button", { name: "동기화 적용", exact: true }).click();
  await page.getByRole("status").waitFor();
  assert.equal(
    await page
      .getByText("Synced", { exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByText("DB 적용 완료 · Gateway 반영 확인 대기", { exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  report.push(
    "Acknowledged sync updates snapshot and history; Gateway stays pending",
  );
  await page.getByRole("tab", { name: "조회 범위", exact: true }).click();
  assert.equal(
    await page
      .getByText("SEOUL, BUSAN", { exact: true })
      .filter({ visible: true })
      .count(),
    2,
  );
  await page.getByRole("tab", { name: "마스킹", exact: true }).click();
  await page.getByLabel("가상 입력", { exact: true }).fill("invalid");
  assert.equal(
    await page
      .getByText("[REDACTED]", { exact: true })
      .filter({ visible: true })
      .count(),
    1,
  );
  report.push("Invalid email falls back to redaction");
  assert.deepEqual(errors, []);
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ko-KR",
  });
  const mp = await mobile.newPage();
  await mp.goto(base);
  await mp
    .getByRole("heading", { name: "정의와 실행 계약", exact: true })
    .waitFor();
  await mp.evaluate(() => document.fonts.ready);
  assert.equal(
    await mp.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await fs.mkdir("docs/demo/contract-review", { recursive: true });
  await mp.screenshot({
    path: "docs/demo/contract-review/mobile.png",
    fullPage: true,
  });
  report.push("Mobile has no document overflow");
  await mp.getByLabel("Language / 언어").selectOption("en");
  await mp
    .getByRole("heading", {
      name: "Definitions and execution contracts",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await mp.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await mp.screenshot({
    path: "docs/demo/contract-review/english-mobile.png",
    fullPage: true,
  });
  report.push("English mobile renders without document overflow");
  await mobile.close();
  await fs.writeFile(
    "docs/demo/contract-review/validation.json",
    JSON.stringify({ checks: report, errors }, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
