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
    const audit = await new AxeBuilder({ page }).analyze();
    report.pages.push({ name, violations: audit.violations });
    if (audit.violations.length)
      throw Error("Accessibility audit failed: " + name);
    await page.screenshot({
      path: path.join(output, name),
      fullPage: !(await page.getByRole("dialog").isVisible()),
    });
  }

  await visit("/roles/role-platform?tab=users");
  await page.getByRole("button", { name: "사용자 추가", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("사용자 검색", { exact: true })
    .fill("member3@example.test");
  await dialog.getByRole("checkbox").check();
  await capture("01-role-user-select.png");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await capture("02-role-user-review.png");
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await visit("/roles/role-platform?tab=users");
  let table = page.getByRole("table", { name: "사용자 목록", exact: true });
  await table.getByText("member3@example.test", { exact: true }).waitFor();
  await capture("03-role-users.png");
  await visit("/users/usr-003?tab=roles");
  if (
    await page.getByRole("button", { name: "역할 부여", exact: true }).count()
  )
    throw Error("Reverse assignment button exists");
  await page
    .getByRole("table", { name: "플랫폼 역할 목록", exact: true })
    .getByRole("link", { name: "플랫폼 관리자", exact: true })
    .waitFor();
  await capture("04-user-read-only.png");
  await visit("/platforms/orion?tab=members");
  if (
    await page
      .getByRole("table", { name: "플랫폼 멤버 목록", exact: true })
      .getByText("member3@example.test", { exact: true })
      .count()
  )
    throw Error("Role grant auto-created membership");
  await page.getByRole("button", { name: "멤버 추가", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("사용자 검색", { exact: true })
    .fill("member3@example.test");
  await dialog.getByRole("checkbox").check();
  await capture("05-platform-member-select.png");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await capture("06-platform-member-review.png");
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await visit("/platforms/orion?tab=members");
  table = page.getByRole("table", { name: "플랫폼 멤버 목록", exact: true });
  await table.getByText("member3@example.test", { exact: true }).waitFor();
  await capture("07-platform-members.png");
  await table
    .getByRole("row")
    .filter({ hasText: "member3@example.test" })
    .getByRole("link", { name: "1개", exact: true })
    .click();
  await page
    .getByRole("table", { name: "플랫폼 역할 목록", exact: true })
    .waitFor();
  if (
    await page.getByRole("button", { name: "역할 부여", exact: true }).count()
  )
    throw Error("Member reverse assignment button exists");
  await capture("08-member-read-only.png");
  await visit("/roles/role-platform?tab=users");
  await page.getByRole("button", { name: "사용자 해제", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("사용자 검색", { exact: true })
    .fill("member3@example.test");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await visit("/platforms/orion?tab=members");
  const memberRow = page
    .getByRole("table", { name: "플랫폼 멤버 목록", exact: true })
    .getByRole("row")
    .filter({ hasText: "member3@example.test" });
  await memberRow.getByRole("link", { name: "0개", exact: true }).waitFor();
  await page.getByRole("button", { name: "멤버 추가", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("사용자 검색", { exact: true })
    .fill("member3@example.test");
  if (await dialog.getByRole("checkbox").count())
    throw Error("Existing member offered again");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  report.interactions.push(
    "Role add/remove preserves membership; member add preserves roles; duplicates excluded; reverse controls absent",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/roles/role-platform?tab=users");
  await page.getByRole("button", { name: "사용자 추가", exact: true }).click();
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile overflow");
  await capture("09-mobile-picker.png");
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
