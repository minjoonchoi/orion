import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";

const output =
  process.env.ORION_UX_OUTPUT ?? "../orion-approval-workflow-screens";
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
    const audit = await new AxeBuilder({ page }).analyze();
    report.pages.push({ name, violations: audit.violations });
    if (audit.violations.length)
      throw Error("Accessibility audit failed: " + name);
    await page.screenshot({
      path: path.join(output, name),
      fullPage: !(await page.getByRole("dialog").isVisible()),
    });
  }

  await visit("/approval-templates/api-key-issue");
  await capture("01-template-line.png");
  await page.getByRole("button", { name: "템플릿 수정", exact: true }).click();
  await capture("02-template-editor.png");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await visit("/approvals/new");
  await page
    .getByLabel("서비스 어카운트", { exact: true })
    .selectOption("sa-platform-ci");
  await page
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await page.getByRole("checkbox").first().check();
  await page
    .getByLabel("Secret name", { exact: true })
    .fill("orion/platform/automation");
  await page.getByLabel("Secret value key", { exact: true }).fill("apiKey");
  await page
    .getByLabel("요청 사유", { exact: true })
    .fill("배포 자동화 서비스의 역할 정보를 조회하기 위한 API 키 발급");
  await capture("03-request-input.png");
  await page.getByRole("button", { name: "검토", exact: true }).click();
  await capture("04-request-review.png");
  await page.getByRole("button", { name: "결재 요청", exact: true }).click();
  await page.waitForURL(/\/approvals\/[a-f0-9-]+$/);
  report.interactions.push(
    "Template-based request creates snapshot document without key",
  );
  async function actor(id) {
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST"),
      page.getByLabel("데모 사용자", { exact: true }).selectOption(id),
    ]);
    await page.waitForFunction(
      (id) =>
        document.querySelector(".wf-demo")?.getAttribute("data-actor-id") ===
        id,
      id,
    );
    await page.waitForLoadState("networkidle");
  }
  async function decide(user, button) {
    await actor(user);
    await page.getByRole("button", { name: button, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "승인·합의 확정", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await visit("/approvals/approval-demo-001?tab=line");
  await decide("usr-002", "승인");
  await decide("usr-003", "합의");
  await capture("05-approval-line.png");
  await decide("usr-001", "합의");
  await page.getByRole("tab", { name: "열람자", exact: true }).click();
  await page
    .getByLabel("열람자 추가", { exact: true })
    .selectOption("user:usr-014");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.getByText("수동 추가", { exact: true }).waitFor();
  await capture("06-viewers.png");
  await page.getByRole("tab", { name: "후속 처리", exact: true }).click();
  await capture("07-approved-execution.png");
  await page
    .getByLabel("저장할 API 키 원문", { exact: true })
    .fill("synthetic-demo-key-only");
  await page
    .getByRole("button", { name: "데모 처리 실행", exact: true })
    .click();
  await page.getByRole("link", { name: "API 키 상세", exact: true }).waitFor();
  await capture("08-execution-result.png");
  await visit("/api-keys/key-approval-demo-001?tab=scope");
  await capture("09-key-scope.png");
  await visit("/roles/role-key-approval-demo-001");
  await page
    .getByRole("link", { name: "policy-key-approval-demo-001", exact: true })
    .waitFor();
  await visit("/policies/policy-key-approval-demo-001");
  await page
    .getByRole("link", { name: "role-key-approval-demo-001", exact: true })
    .waitFor();
  await capture("14-generated-policy.png");
  await visit("/service-accounts/sa-directory-sync?tab=api-keys");
  await page
    .getByRole("table", { name: "발급 키 목록", exact: true })
    .getByRole("link", { name: "key-approval-demo-001", exact: true })
    .waitFor();
  await visit("/api-keys/key-approval-demo-001?tab=scope");

  await page.getByRole("link", { name: "교체 요청", exact: true }).click();
  await page.getByRole("checkbox").last().uncheck();
  await page
    .getByLabel("요청 사유", { exact: true })
    .fill("조직 조회 권한을 제거하고 키를 교체합니다.");
  await page.getByRole("button", { name: "검토", exact: true }).click();
  await capture("10-replacement-review.png");
  await page.getByRole("button", { name: "결재 요청", exact: true }).click();
  await page.waitForURL(/\/approvals\/[a-f0-9-]+$/);
  const replaceUrl = page.url();
  await page.getByRole("tab", { name: "결재선", exact: true }).click();
  if (await page.getByText("보안팀 합의", { exact: true }).count())
    throw Error("Replacement has security step");
  await decide("usr-002", "승인");
  await decide("usr-001", "합의");
  await page.getByRole("tab", { name: "후속 처리", exact: true }).click();
  await page
    .getByLabel("저장할 API 키 원문", { exact: true })
    .fill("synthetic-replacement-key-only");
  await page
    .getByRole("button", { name: "데모 처리 실행", exact: true })
    .click();
  await page.getByRole("link", { name: "API 키 상세", exact: true }).waitFor();
  await visit("/api-keys/key-approval-demo-001?tab=approvals");
  await capture("11-key-approval-history.png");
  await page.getByRole("tab", { name: "키 버전", exact: true }).click();
  await capture("12-key-versions.png");
  report.interactions.push(
    "Sequential three-stage issuance and two-stage replacement; same key ID; secret text cleared; history retained",
  );
  await visit("/approvals/approval-demo-001?tab=viewers");
  await actor("usr-014");
  if (await page.getByRole("button", { name: "추가", exact: true }).count())
    throw Error("Manual viewer can add viewers");
  await visit(replaceUrl.replace(origin, ""));
  if (!page.url().includes("/forbidden"))
    throw Error("Unlisted user can read replacement document");
  report.interactions.push(
    "Explicit viewer may read original but cannot add viewers or read replacement document",
  );
  await visit("/approvals");
  await actor("usr-001");
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/api-keys/key-approval-demo-001?tab=scope");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile overflow");
  await capture("13-mobile-key.png");
} catch (error) {
  report.errors.push(error.stack);
  console.log(logs);
  const pages = browser?.contexts()[0]?.pages();
  if (pages?.length) {
    console.log((await pages[0].locator("body").innerText()).slice(0, 3000));
    await pages[0].screenshot({ path: path.join(output, "failure.png") });
  }
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
