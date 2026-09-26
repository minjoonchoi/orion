import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
const output = "docs/screenshots/unified-approvals";
const origin = "http://127.0.0.1:3136";
const server = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3136",
  ],
  {
    env: {
      ...process.env,
      ORION_DATA_SOURCE: "demo",
      ORION_ENVIRONMENT: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Server timeout")), 30000);
    server.stdout.on("data", (data) => {
      if (data.toString().includes("Ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.on("exit", () => {
      clearTimeout(timeout);
      reject(Error("Server exited"));
    });
  });
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: "ko-KR",
  });
  const page = await context.newPage();
  async function visit(path) {
    await page.goto(origin + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
  }
  async function capture(name) {
    const audit = await new AxeBuilder({ page }).analyze();
    if (audit.violations.length) throw Error(JSON.stringify(audit.violations));
    await page.screenshot({
      path: `${output}/${name}.png`,
      fullPage: !(await page.getByRole("dialog").isVisible()),
    });
  }
  await visit("/approvals");
  await capture("01-approvals");
  await page.getByRole("tab", { name: "결재 템플릿", exact: true }).click();
  await capture("08-templates-tab");
  await visit("/approvals/new");
  await page.getByRole("radio", { name: "API 키 발급", exact: true }).check();
  await capture("02-approval-type");
  await visit("/api-keys");
  await page.getByRole("button", { name: "발급 요청", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("서비스 어카운트", { exact: true })
    .selectOption("sa-platform-ci");
  await dialog
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByLabel("엔드포인트 검색", { exact: true }).fill("GET");
  await dialog
    .getByLabel("Secret name", { exact: true })
    .fill("orion/platform/automation");
  await dialog.getByLabel("Secret value key", { exact: true }).fill("apiKey");
  await dialog
    .getByLabel("요청 사유", { exact: true })
    .fill("배포 자동화 서비스에서 Orion 역할 정보를 조회하기 위한 API 키 발급");
  await capture("03-issuance-modal");
  await dialog.getByRole("button", { name: "검토", exact: true }).click();
  await capture("04-issuance-review");
  await visit("/approval-templates/api-key-issue/edit");
  await capture("05-template-edit-line");
  await page.getByRole("tab", { name: "입력 필드", exact: true }).click();
  await capture("06-template-edit-fields");
  await visit("/approval-templates/new");
  await page
    .getByLabel("이름", { exact: true })
    .fill("자동화 연동 API 키 발급");
  await capture("07-template-create");
  await page.goto(
    "file://" +
      process.cwd() +
      "/docs/demo/orion.html#/approvals?tab=templates",
  );
  await page
    .getByRole("table", { name: "결재 템플릿 목록", exact: true })
    .waitFor();
  await capture("09-standalone-templates");
  console.log("Captured 9 screens; accessibility audits passed.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
