import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

const output = process.env.ORION_UX_OUTPUT ?? "../orion-ux-review-screens";
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
  const roots = [
    "/",
    "/users",
    "/organizations",
    "/service-accounts",
    "/roles",
    "/policies",
    "/resources",
    "/policies/sync",
    "/resource-sync/history",
    "/api-keys",
    "/approval-templates",
    "/approvals",
    "/login",
    "/forbidden",
    "/audit-logs",
    "/access-grants",
    "/components",
    "/services",
    "/service-endpoints",
    "/workspaces",
    "/pages",
    "/resource-sync",
    "/policy-sync",
  ];
  const details = new Set([
    "/services/svc-orion",
    "/service-endpoints/ep-users",
    "/workspaces/ws-platform",
    "/pages/page-users",
  ]);
  if (interactionsOnly) {
    roots.length = 0;
    details.clear();
  }
  for (const route of roots) {
    await visit(route);
    const links = await page
      .locator("main a[href]")
      .evaluateAll((elements) => elements.map((e) => e.getAttribute("href")));
    if (!["/", "/resources"].includes(route)) {
      const link = links.find(
        (h) => h.startsWith(route + "/") && !h.includes("sync"),
      );
      if (link) details.add(link);
    }
    const violations =
      route === "/components"
        ? []
        : (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa"])
              .analyze()
          ).violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          }));
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    report.pages.push({
      route,
      heading: await page.locator("h1").allTextContents(),
      violations,
      mobileOverflow: overflow,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    console.log("Reviewed", route);
  }
  for (const route of details) {
    await visit(route);
    const tabs = await page.getByRole("tab").allTextContents();
    for (let i = 0; i < tabs.length; i++) {
      await page.getByRole("tab").nth(i).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(200);
    }
    report.pages.push({
      route,
      heading: await page.locator("h1").allTextContents(),
      tabs,
    });
    console.log("Reviewed", route, tabs.length, "tabs");
  }
  await visit("/users");
  await page.getByLabel("사용자 목록 검색").fill("김가람");
  await page.getByRole("link", { name: "김가람", exact: true }).click();
  await page.waitForURL(/\/users\/usr-001$/);
  await page.goBack({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("사용자 목록 검색").inputValue(),
    "김가람",
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.getByLabel("사용자 목록 검색").inputValue(),
    "김가람",
  );
  report.interactions.push("List search survives detail/back and reload");
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  if (font) await page.addStyleTag({ content: font });
  await capture("01-users.png");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page
      .locator("main")
      .evaluate((e) => e.getBoundingClientRect().top < 240),
  );
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "조직", exact: true })
    .click();
  await page.waitForURL(/\/organizations$/);
  await page.waitForLoadState("networkidle");
  assert.equal(
    await page
      .getByRole("button", { name: "메뉴 열기" })
      .getAttribute("aria-expanded"),
    "false",
  );
  if (font) await page.addStyleTag({ content: font });
  await capture("02-mobile.png");
  report.interactions.push("Mobile menu opens and collapses after navigation");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await visit("/resources");
  await capture("03-resources.png");
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("services");
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
  await page.getByText("선택 목록 확인", { exact: true }).click();
  await capture("10-resource-selection.png");
  await page.getByRole("button", { name: "선택 리소스 영향도 보기" }).click();
  await page.getByRole("dialog").locator(".impact-scope li").last().waitFor();
  await page.setViewportSize({ width: 1440, height: 1400 });
  await capture("11-selected-resource-impact.png");
  await page
    .getByRole("combobox", { name: "영향도 조회 범위" })
    .selectOption("services:svc-orion");
  await capture("12-single-resource-impact.png");
  await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("all");
  report.interactions.push(
    "Selected resources define impact scope; per-resource focus preserves selection",
  );
  await page
    .getByRole("button", { name: /diff 확인/ })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await capture("04-resource-diff.png");
  await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await page.getByRole("button", { name: /Sync · 영향도 검토/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  await page.getByRole("dialog").locator(".sync-confirm input").waitFor();
  await capture("05-sync-review.png");
  await page.getByRole("dialog").locator(".sync-confirm input").check();
  await page.getByRole("button", { name: "최종 Sync 적용" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  report.interactions.push("Resource diff, review and explicit sync");
  await visit("/resources?type=services&history=services:svc-orion");
  await page.locator(".sync-history-entry").first().locator("summary").click();
  await capture("08-resource-history.png");
  await page.locator(".sync-history-entry").last().locator("summary").click();
  await page
    .getByRole("button", { name: "이 revision으로 롤백" })
    .last()
    .click();
  await page.getByRole("dialog").waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "롤백 적용", exact: true })
      .isDisabled(),
  );
  await capture("06-rollback-review.png");
  await page.setViewportSize({ width: 1440, height: 1320 });
  await page.getByLabel("관계 검색", { exact: true }).fill("김다온");
  await capture("09-impact-depth.png");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
  report.interactions.push(
    "Rollback requires confirmation and can be cancelled",
  );
  await visit("/users/usr-014");
  await page.getByRole("button", { name: "역할 부여", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .check();
  await page.getByRole("button", { name: "변경사항 검토" }).click();
  await page.getByText("변경 후 정책·리소스 확인", { exact: true }).click();
  await capture("07-role-review.png");
  await page.getByRole("button", { name: "변경 적용", exact: true }).click();
  await page.getByRole("button", { name: "완료", exact: true }).waitFor();
  report.interactions.push(
    "Role grant selection, impact review and completion",
  );
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await visit("/policies/policy-platform");
  assert.equal(
    await page.getByRole("button", { name: "리소스 연결과 정책 효과" }).count(),
    0,
  );
  await page.getByRole("link", { name: "정책 변경 검토" }).click();
  await page.waitForLoadState("networkidle");
  report.interactions.push("Policy edit has one GitOps entry point");
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await visit("/resources");
  await page
    .getByRole("combobox", { name: "Sync status", exact: true })
    .waitFor();
  report.interactions.push("English resource filters render");
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
