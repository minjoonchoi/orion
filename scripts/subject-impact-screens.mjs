import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

const output = process.env.ORION_UX_OUTPUT ?? "../orion-subject-impact-screens";
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
  await page.getByRole("button", { name: "영향도 보기", exact: true }).click();
  let impact = page.getByRole("region", { name: "영향받는 대상", exact: true });
  await impact.getByLabel("영향 대상·경로 검색").fill("김가람");
  await impact.locator(".subject-row > summary").click();
  await capture("01-user-impact-paths.png");
  await impact.getByLabel("영향 대상·경로 검색").clear();
  await impact.getByRole("button", { name: "조직 2", exact: true }).click();
  await impact
    .locator(".subject-row")
    .filter({ hasText: "org-platform" })
    .locator("summary")
    .first()
    .click();
  await capture("02-organization-impact.png");
  await impact
    .getByRole("button", { name: "서비스 어카운트 1", exact: true })
    .click();
  await impact.locator(".subject-row > summary").click();
  await capture("03-service-account-impact.png");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/policies/sync");
  const card = page
    .locator(".sync-diffs > details")
    .filter({ hasText: "policy-platform" });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "이 정책 Sync" }).click();
  await page
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  impact = page.locator(".sync-workflow-impact .subject-impact");
  await impact
    .getByRole("button", { name: "서비스 어카운트 1", exact: true })
    .click();
  await impact.locator(".subject-row > summary").click();
  await capture("04-policy-sync-subjects.png");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/roles/role-platform");
  await page
    .getByRole("button", { name: "역할 부여 관리", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "정책 부여와 만료", exact: true })
    .click();
  await dialog
    .locator(".access-card")
    .filter({ hasText: "플랫폼 조회" })
    .getByRole("checkbox")
    .first()
    .uncheck();
  await dialog
    .getByRole("button", { name: "변경사항 검토", exact: true })
    .click();
  impact = dialog.getByRole("region", { name: "영향받는 대상", exact: true });
  await impact
    .getByRole("button", { name: "서비스 어카운트 1", exact: true })
    .click();
  await impact.locator(".subject-row > summary").click();
  await impact.scrollIntoViewIfNeeded();
  await capture("05-policy-removal-impact.png");
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/services/svc-orion");
  await page.getByRole("button", { name: "View impact", exact: true }).click();
  impact = page.getByRole("region", { name: "Affected subjects", exact: true });
  await impact
    .getByRole("button", { name: "Service accounts 1", exact: true })
    .click();
  await impact.locator(".subject-row > summary").click();
  await impact.scrollIntoViewIfNeeded();
  await capture("06-mobile-service-account.png");
  report.pages.push({
    route: "subject-impact",
    violations: (await new AxeBuilder({ page }).analyze()).violations,
  });
  report.interactions.push(
    "Direct users, organizations without members, service accounts; policy Sync and removal; English mobile",
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
