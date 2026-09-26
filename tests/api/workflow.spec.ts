import { test, expect } from "@playwright/test";
test("approval workflow loads via API and request commands create snapshots", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "ko", url: "http://127.0.0.1:3200" },
    {
      name: "orion_session",
      value: "workflow-request",
      url: "http://127.0.0.1:3200",
    },
  ]);
  await page.goto("/approvals/new");
  await page.getByRole("radio", { name: "API 키 발급", exact: true }).check();
  await page.getByRole("button", { name: "작성 시작", exact: true }).click();
  await expect(page.getByLabel("데모 사용자", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("서비스 어카운트", { exact: true })
    .selectOption("sa-platform-ci");
  await page
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await page.getByRole("checkbox").first().check();
  await page
    .getByLabel("Secret name", { exact: true })
    .fill("orion/api-contract/test");
  await page.getByLabel("Secret value key", { exact: true }).fill("apiKey");
  await page.getByLabel("요청 사유", { exact: true }).fill("API 계약 확인");
  await page.getByRole("button", { name: "검토", exact: true }).click();
  await page.getByRole("button", { name: "결재 요청", exact: true }).click();
  await expect(page).toHaveURL(/approvals\/[a-f0-9-]+$/);
  await expect(page.locator("[data-detail-summary]")).toContainText(
    "결재 진행",
  );
});
test("API 403 is not replaced with demo approval data", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion_session", value: "forbidden", url: "http://127.0.0.1:3200" },
  ]);
  await page.goto("/approvals");
  await expect(page).toHaveURL(/forbidden/);
});

test("endpoint selections survive pagination and service changes clear them", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "ko", url: "http://127.0.0.1:3200" },
    {
      name: "orion_session",
      value: "workflow-many-endpoints",
      url: "http://127.0.0.1:3200",
    },
  ]);
  await page.goto("/approvals/new?template=api-key-issue");
  await page
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("navigation", { name: "엔드포인트 페이지 이동", exact: true })
    .getByRole("button", { name: "다음", exact: true })
    .click();
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "선택만 보기 (2)", exact: true })
    .click();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await expect(page.getByRole("checkbox").last()).toBeChecked();
  await page
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-directory");
  await expect(
    page.getByRole("button", { name: "선택만 보기 (0)", exact: true }),
  ).toBeVisible();
});

test("server identity controls document visibility and template administration", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "ko", url: "http://127.0.0.1:3200" },
    {
      name: "orion_session",
      value: "workflow-outsider",
      url: "http://127.0.0.1:3200",
    },
  ]);
  await page.goto("/approvals");
  await expect(
    page.getByRole("link", {
      name: "API 키 발급 · directory-sync",
      exact: true,
    }),
  ).toHaveCount(0);
  for (const path of [
    "/approvals/approval-demo-001",
    "/approval-templates/new",
    "/approval-templates/api-key-issue/edit",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/forbidden/);
  }
});
test("no registered templates cannot create a document", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "ko", url: "http://127.0.0.1:3200" },
    { name: "orion_session", value: "api-empty", url: "http://127.0.0.1:3200" },
  ]);
  await page.goto("/approvals/new");
  await expect(
    page.getByRole("button", { name: "작성 시작", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.goto("/approvals/new?template=unregistered");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "결재 요청", exact: true }),
  ).toHaveCount(0);
});
