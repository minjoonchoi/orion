import { expect, type Page } from "@playwright/test";
// The demo contains eight pending items, all on this explicitly selected page.
export async function reviewDemoItems(page: Page, english = false) {
  await page.goto("/resources?status=out-of-sync");
  await expect(page.locator(".sync-catalog tbody tr")).toHaveCount(8);
  await page
    .getByRole("checkbox", {
      name: english
        ? "Select resources on this page"
        : "현재 페이지 리소스 선택",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: english ? "Sync selected items" : "선택 항목 동기화",
      exact: true,
    })
    .click();
}
