import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

const output =
  process.env.ORION_UX_OUTPUT ?? "../orion-resource-navigation-screens";
fs.mkdirSync(output, { recursive: true });
const origin = "http://127.0.0.1:3135";
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
    "3135",
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
  await visit("/domains/identity");
  await page
    .getByRole("heading", { name: "임직원 관리", exact: true })
    .waitFor();
  await capture("01-domain-actions.png");
  await visit("/actions/identity~read-hr");
  await page.getByRole("heading", { name: "정책별 응답 범위" }).waitFor();
  await capture("02-action-policies.png");
  await visit("/service-endpoints/identity-api~detail");
  await page.getByRole("tab", { name: "연결 관계", exact: true }).click();
  await capture("03-endpoint-actions.png");
  await visit("/policies/policy-platform");
  await page
    .getByRole("heading", { name: "인사 사용자 상세 조회", exact: true })
    .waitFor();
  await capture("04-policy-fields.png");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  await page
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .waitFor();
  await capture("05-sync-targets.png");
  await page
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await page.getByRole("tab", { name: "YAML diff", exact: true }).waitFor();
  await capture("06-yaml-diff.png");
  await page.getByRole("tab", { name: "영향도", exact: true }).click();
  await page.locator(".def-subject summary").first().click();
  await capture("07-impact.png");
  const audit = await new AxeBuilder({ page }).analyze();
  report.pages.push({ name: "impact", violations: audit.violations });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/actions/identity~read-hr");
  await page.getByRole("tab", { name: "권한 평가", exact: true }).click();
  await page
    .getByRole("combobox", { name: "권한 평가 대상" })
    .selectOption("users:usr-001");
  await page.getByRole("button", { name: "권한 평가", exact: true }).click();
  await page.locator("[role=tabpanel]:visible .def-table").waitFor();
  await capture("08-access-evaluation.png");
  await visit("/resources?status=out-of-sync");
  await page.locator(".def-table tbody tr").first().waitFor();
  await capture("09-change-management.png");
  if (report.errors.length || audit.violations.length)
    throw Error("UI audit failed");
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
