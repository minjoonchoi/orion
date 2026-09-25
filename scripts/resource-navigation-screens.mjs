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
  await visit("/workspaces");
  await capture("01-workspaces.png");
  await visit("/service-endpoints");
  await page
    .getByLabel("서비스 필터", { exact: true })
    .selectOption("svc-orion");
  await capture("02-endpoint-exploration.png");
  await visit("/policies");
  await capture("03-policy-exploration.png");
  await visit("/resources?status=out-of-sync");
  await page.getByRole("table", { name: "변경 관리", exact: true }).waitFor();
  await capture("04-change-management.png");
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("policies");
  await page
    .getByRole("table", { name: "변경 관리", exact: true })
    .getByRole("row")
    .filter({ hasText: "policy-platform" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("service-endpoints");
  await page
    .getByRole("table", { name: "변경 관리", exact: true })
    .getByRole("row")
    .filter({ hasText: "ep-users-list" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "선택 항목 동기화", exact: true })
    .click();
  await page.getByRole("table", { name: "동기화 대상", exact: true }).waitFor();
  await capture("05-mixed-sync-targets.png");
  await page
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await page.locator(".sync-workflow-impact .subject-impact").waitFor();
  await capture("06-mixed-impact-review.png");
  report.pages.push({
    route: "change-review",
    violations: (await new AxeBuilder({ page }).analyze()).violations,
  });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/resources?type=services&status=out-of-sync");
  await page
    .getByRole("table", { name: "변경 관리", exact: true })
    .getByRole("row")
    .filter({ hasText: "svc-orion" })
    .getByRole("button", { name: "Orion · 동기화", exact: true })
    .click();
  await page.getByRole("table", { name: "동기화 대상", exact: true }).waitFor();
  await capture("08-single-resource-sync.png");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/service-endpoints");
  report.pages.push({
    route: "endpoints-mobile",
    mobileOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    violations: (await new AxeBuilder({ page }).analyze()).violations,
  });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await capture("07-mobile-navigation.png");
  report.interactions.push(
    "Applied resource catalogs; policies in resource navigation; combined change catalog; mixed policy and resource Sync",
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
