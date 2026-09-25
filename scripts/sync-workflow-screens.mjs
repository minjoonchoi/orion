import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

const output = process.env.ORION_UX_OUTPUT ?? "../orion-sync-workflow-screens";
fs.mkdirSync(output, { recursive: true });
const origin = "http://127.0.0.1:3125";
const server = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    ...(process.env.ORION_UX_PRODUCTION === "1"
      ? ["start"]
      : ["dev", "--webpack"]),
    "--hostname",
    "127.0.0.1",
    "--port",
    "3125",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ORION_DATA_SOURCE: "demo",
      ORION_ENVIRONMENT: "test",
    },
  },
);
let browser;
let logs = "";
server.stderr.on("data", (data) => {
  logs += data;
});
const report = { pages: [], interactions: [], errors: [] };
const interactionsOnly = process.env.ORION_UX_INTERACTIONS_ONLY === "1";
if (interactionsOnly && fs.existsSync(path.join(output, "audit-results.json")))
  report.pages = JSON.parse(
    fs.readFileSync(path.join(output, "audit-results.json"), "utf8"),
  ).pages;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error(logs || "Server timeout")),
      30000,
    );
    server.stdout.on("data", (data) => {
      if (data.toString().includes("Ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", () => {
      clearTimeout(timer);
      reject(Error(logs));
    });
  });
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  let font = "";
  if (process.env.ORION_SCREENSHOT_FONT_DIR) {
    const root = process.env.ORION_SCREENSHOT_FONT_DIR;
    font = fs
      .readFileSync(path.join(root, "400.css"), "utf8")
      .replace(
        /url\(\.\/([^)]*)\)/g,
        (_, file) =>
          `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, file)).toString("base64")})`,
      );
    font +=
      '\nbody,button,input,select,textarea,code,pre {font-family:"Noto Sans KR",sans-serif !important;} nextjs-portal {display:none;}';
  }
  async function visit(route) {
    await page.goto(origin + route, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    if (font) await page.addStyleTag({ content: font });
    await page.evaluate(() => document.fonts.ready);
  }
  async function capture(name) {
    await page.screenshot({
      path: path.join(output, name),
      fullPage: !(await page.getByRole("dialog").isVisible()),
    });
  }
  await visit("/services/svc-orion");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await page.getByRole("table", { name: "Sync 대상" }).waitFor();
  await capture("01-detail-sync-target.png");
  await page
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  await page.locator(".sync-confirm input").waitFor();
  await capture("02-detail-sync-review.png");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/resources?type=services");
  await page
    .getByRole("row")
    .filter({ hasText: "svc-orion" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("workspaces");
  await page
    .getByRole("row")
    .filter({ hasText: "ws-platform" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "선택 리소스 Sync", exact: true })
    .click();
  await page.getByRole("table", { name: "Sync 대상" }).waitFor();
  await capture("03-selected-sync-targets.png");
  await page
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  await page.locator(".sync-confirm input").waitFor();
  await capture("04-selected-sync-review.png");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/policies/sync");
  const card = page
    .locator(".sync-diffs > details")
    .filter({ hasText: "policy-platform" });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "이 정책 Sync" }).click();
  await page.getByRole("table", { name: "Sync 대상" }).waitFor();
  await capture("05-policy-resource-targets.png");
  await page
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  await page.locator(".sync-confirm input").waitFor();
  await capture("06-policy-role-impact.png");
  const diff = page.locator(".sync-review-list > details").first();
  await diff.locator("summary").click();
  await diff.scrollIntoViewIfNeeded();
  await capture("07-policy-diff.png");
  await page.getByRole("button", { name: "대상으로 돌아가기" }).click();
  await page.getByRole("table", { name: "Sync 대상" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("dialog").evaluate((el) => (el.scrollTop = 0));
  await capture("08-mobile-targets.png");
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  report.pages.push({ route: "policy-sync-dialog", violations });
  report.interactions.push(
    "Single detail and selected list share two stages; policy resources, role impact and diff captured",
  );
} catch (error) {
  report.errors.push(error.stack);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, "audit-results.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      pages: report.pages.length,
      interactions: report.interactions,
      errors: report.errors,
      violations: report.pages.filter(
        (p) => p.violations?.length || p.mobileOverflow,
      ),
    }),
  );
  await browser?.close();
  server.kill("SIGTERM");
}
