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
