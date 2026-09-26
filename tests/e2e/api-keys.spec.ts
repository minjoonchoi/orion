import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("new keys are absent until execution and existing metadata is preserved", async ({
  page,
}) => {
  await page.goto("/api-keys");
  await expect(
    page.getByRole("link", { name: "발급 요청", exact: true }),
  ).toBeVisible();
  await page.locator("summary").click();
  const table = page.getByRole("table", { name: "기존 API 키", exact: true });
  await expect(table).toBeVisible();
  await page.getByLabel("기존 API 키 검색").fill("디렉터리");
  await table
    .getByRole("link", { name: "디렉터리 동기화", exact: true })
    .click();
  await expect(page.getByText("•••• a001", { exact: true })).toBeVisible();
  await page.goto("/api-keys/missing");
  await expect(
    page.getByRole("heading", { name: "API 키를 찾을 수 없습니다" }),
  ).toBeVisible();
});
test("legacy documents without viewer migration are not exposed through key history", async ({
  page,
}) => {
  await page.goto("/api-keys/key-directory?tab=approvals");
  await expect(
    page.getByRole("link", { name: "approval-006", exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/approvals/approval-006");
  await expect(page).toHaveURL(/forbidden/);
});
