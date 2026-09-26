import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("organization key counts lead to service scoped keys and detail", async ({
  page,
}) => {
  await page.goto("/organizations/org-platform?tab=service-accounts");
  const accounts = page.getByRole("table", {
    name: "서비스 어카운트 목록",
    exact: true,
  });
  await accounts
    .getByRole("row")
    .filter({ hasText: "platform-ci" })
    .getByRole("link", { name: "2개", exact: true })
    .click();
  await expect(page).toHaveURL(/sa-platform-ci\?tab=api-keys/);
  const table = page.getByRole("table", {
    name: "API 키 목록",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("관리 서비스 필터").selectOption("svc-directory");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("이전 CI 연동");
  await page.reload();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await table.getByRole("link", { name: "이전 CI 연동", exact: true }).click();
  const info = page.locator("[data-detail-summary]");
  await expect(info).toContainText("platform-ci");
  await expect(
    info.getByRole("link", { name: "사내 디렉터리", exact: true }),
  ).toHaveAttribute("href", "/services/svc-directory");
});
test("issuance starts a template-based approval without creating a live key", async ({
  page,
}) => {
  await page.goto("/service-accounts/sa-platform-ci?tab=api-keys");
  await page.getByRole("link", { name: "발급 요청", exact: true }).click();
  await expect(page.getByLabel("서비스 어카운트", { exact: true })).toHaveValue(
    "sa-platform-ci",
  );
  await page
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await page.getByRole("checkbox").first().check();
  await page
    .getByLabel("Secret name", { exact: true })
    .fill("orion/platform/test");
  await page.getByLabel("Secret value key", { exact: true }).fill("apiKey");
  await page.getByLabel("요청 사유", { exact: true }).fill("자동화 연동");
  await page.getByRole("button", { name: "검토", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "결재 요청", exact: true }).click();
  await expect(page).toHaveURL(/approvals\/[a-f0-9-]+$/);
  await expect(page.locator("[data-detail-summary]")).toContainText(
    "결재 진행",
  );
  await page.goto("/service-accounts/sa-audit-export?tab=api-keys");
  await expect(
    page.getByRole("link", { name: "발급 요청", exact: true }),
  ).toHaveCount(0);
});
