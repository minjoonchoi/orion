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

  await visit("/platforms");
  await page.getByRole("table", { name: "플랫폼 목록", exact: true }).waitFor();
  await capture("01-platforms.png");
  await visit("/platforms/orion?tab=members");
  await page
    .getByRole("table", { name: "플랫폼 멤버 목록", exact: true })
    .waitFor();
  await capture("02-platform-members.png");
  await visit("/users/usr-001?tab=roles");
  await page.getByRole("combobox", { name: "역할을 관리할 플랫폼" }).waitFor();
  await capture("03-user-roles.png");
  await page.getByRole("button", { name: "역할 부여", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (await dialog.getByLabel("정산 검토자").count())
    throw Error("Cross-platform role leaked");
  await dialog.getByLabel("업무 조회자").check();
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await capture("04-role-review.png");
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await visit("/platforms/orion/members/member-001?tab=roles");
  await page
    .getByRole("table", { name: "플랫폼 역할 목록", exact: true })
    .getByRole("link", { name: "업무 조회자", exact: true })
    .waitFor();
  await capture("05-member-roles.png");
  await visit("/platforms/finance/members/member-001?tab=roles");
  const roles = page.getByRole("table", {
    name: "플랫폼 역할 목록",
    exact: true,
  });
  await roles.getByRole("link", { name: "정산 검토자", exact: true }).waitFor();
  if (
    await roles.getByRole("link", { name: "업무 조회자", exact: true }).count()
  )
    throw Error("Role write crossed platforms");
  report.interactions.push(
    "User assignment reflected in member view; Finance assignment unchanged",
  );
  await visit("/roles/role-platform?tab=users");
  await page.getByRole("table", { name: "사용자 목록", exact: true }).waitFor();
  await capture("06-role-users.png");
  await visit("/platforms/orion?tab=authentication");
  await capture("07-platform-authentication.png");
  await visit("/service-accounts/sa-platform-ci?tab=api-keys");
  await capture("08-service-account.png");
  await visit("/workspaces?platform=finance");
  await page
    .getByRole("combobox", { name: "플랫폼 필터", exact: true })
    .waitFor();
  await capture("09-workspaces.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await visit("/users/usr-001?tab=roles");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("Mobile viewport overflow");
  report.interactions.push("Mobile user roles layout fits viewport");
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
