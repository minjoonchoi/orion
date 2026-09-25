import { test, expect } from "@playwright/test";
test("navigation groups child resources under parents and persists selected keys", async ({
  page,
}) => {
  await page.goto("/resources?status=out-of-sync");
  const nav = page.getByRole("navigation");
  await expect(
    nav.getByRole("link", { name: "업무 도메인", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "엔드포인트", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "현재 페이지 선택", exact: true })
    .check();
  await expect(page.locator(".def-selection")).toContainText("선택한 항목 2");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "현재 페이지 선택", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "선택 해제", exact: true }).click();
  await expect(page.locator(".def-selection")).toHaveCount(0);
});
