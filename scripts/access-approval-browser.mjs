import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const dir = "docs/demo/access-approval-review";
await fs.mkdir(dir, { recursive: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = pathToFileURL(path.resolve("docs/demo/preview.html")).href + "#";
async function go(p) {
  await page.goto(base + p);
  await page.locator("main h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(name) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}
async function actor(id) {
  await page.evaluate((id) => {
    for (const v of globalThis.orionApprovalSessions.values())
      v.state.actorId = id;
  }, id);
  await go("/approvals");
}
async function tab(name) {
  await page.getByRole("tab", { name, exact: true }).click();
}
async function decide(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .filter({ hasText: label })
    .last()
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
try {
  await go("/access-requests/new");
  await page
    .getByRole("combobox", { name: "신청 역할", exact: true })
    .selectOption("role-security");
  await page.getByLabel("사용 종료일", { exact: true }).fill("2026-12-31");
  await page
    .getByRole("textbox", { name: "신청 사유", exact: true })
    .fill("분기 보안 검토 업무를 위한 권한 신청");
  await page
    .getByRole("button", { name: "신청 내용 검토", exact: true })
    .click();
  await capture("request-review");
  await page.getByRole("button", { name: "신청 제출", exact: true }).click();
  await page
    .getByRole("heading", { name: "내 접근 권한", exact: true })
    .waitFor();
  const link = page
    .getByRole("table", { name: "내 권한 신청", exact: true })
    .getByRole("link", { name: "보안 검토자", exact: true });
  await link.waitFor();
  const url = (await link.getAttribute("href")).replace(/^#/, "");
  await capture("request-submitted");
  await link.click();
  await tab("요청 정보");
  await page
    .getByRole("tabpanel", { name: "요청 정보", exact: true })
    .getByText("분기 보안 검토 업무를 위한 권한 신청", { exact: true })
    .waitFor();
  await capture("approval-request");
  await tab("결재선");
  assert.equal(
    await page.getByRole("button", { name: "승인", exact: true }).count(),
    0,
  );
  await actor("usr-002");
  await go(url + "?tab=line");
  await decide("승인");
  await actor("usr-003");
  await go(url + "?tab=line");
  await capture("approval-line");
  await decide("합의");
  await tab("후속 처리");
  await page
    .getByRole("button", { name: "권한 반영 검토", exact: true })
    .waitFor();
  await capture("approved-awaiting-grant");
  await page
    .getByRole("button", { name: "권한 반영 검토", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "권한 반영", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByText("처리 완료", { exact: true }).first().waitFor();
  await capture("grant-completed");
  await actor("usr-001");
  await go("/my-access");
  await page
    .getByRole("table", { name: "권한 목록", exact: true })
    .getByText("보안 검토자", { exact: true })
    .waitFor();
  await capture("my-granted-access");
  await go("/my-access?tab=requests");
  await page.getByText("승인 완료", { exact: true }).waitFor();
  await page.getByText("처리 완료", { exact: true }).first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("requests-mobile");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.locator("header select").first().selectOption("en");
  await page
    .getByRole("table", { name: "My access requests", exact: true })
    .waitFor();
  await capture("requests-mobile-en");
  assert.deepEqual(errors, []);
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".png"));
  await fs.writeFile(
    dir + "/manifest.json",
    JSON.stringify(
      {
        html: hash(await fs.readFile("docs/demo/preview.html")),
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
    "Browser: request → approval document → two approvers → review and grant → My access; mobile and English passed.",
  );
} finally {
  await browser.close();
}
