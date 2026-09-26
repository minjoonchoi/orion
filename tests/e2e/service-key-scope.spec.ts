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
test("key issuance selects and reviews account and service without creating a live key", async ({
  page,
}) => {
  await page.goto("/service-accounts/sa-platform-ci?tab=api-keys");
  await page
    .getByRole("button", { name: "API 키 발급 요청", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await dialog.getByLabel("키 이름", { exact: true }).fill("CI 교체 키");
  await dialog.getByLabel("만료일", { exact: true }).fill("2099-01-01T12:00");
  await dialog.getByLabel("요청 사유", { exact: true }).fill("정기 키 교체");
  await dialog
    .getByRole("button", { name: "요청 내용 검토", exact: true })
    .click();
  await expect(dialog).toContainText("platform-ci");
  await expect(dialog).toContainText("Orion");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog
    .getByRole("button", { name: "발급 요청 제출", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "발급 요청이 접수되었습니다.",
  );
  await expect(dialog.getByRole("status")).toContainText(
    "실제 키를 생성하지 않습니다",
  );
  await page.goto("/service-accounts/sa-audit-export?tab=api-keys");
  await expect(
    page.getByRole("button", { name: "API 키 발급 요청", exact: true }),
  ).toBeDisabled();
});
