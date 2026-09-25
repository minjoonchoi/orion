import { test, expect } from "@playwright/test";

test("resource group separates applied exploration from mixed policy/resource change review", async ({
  page,
}) => {
  await page.goto("/services");
  const nav = page
    .locator(".navigation-group")
    .filter({ has: page.locator("#nav-resources") });
  await expect(nav.locator("a")).toHaveText([
    "워크스페이스",
    "페이지",
    "서비스",
    "엔드포인트",
    "정책",
    "변경 관리",
  ]);
  await expect(page.locator("#nav-authorization")).toHaveText("권한 관리");
  await expect(
    page.getByRole("heading", { name: "서비스", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Orion", exact: true }).click();
  await expect(page.locator("nav a[aria-current=page]")).toHaveAttribute(
    "href",
    "/services",
  );
  await page.goto("/resources?type=policies&status=out-of-sync");
  const table = page.getByRole("table", { name: "변경 관리", exact: true });
  await table
    .getByRole("row")
    .filter({ hasText: "policy-platform" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("service-endpoints");
  await table
    .getByRole("row")
    .filter({ hasText: "ep-users-list" })
    .getByRole("checkbox")
    .check();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "리소스 선택", exact: true }),
  ).toContainText("선택한 리소스 · 2");
  await page
    .getByRole("button", { name: "선택 리소스 동기화", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const targets = dialog.getByRole("table", { name: "동기화 대상" });
  await expect(targets).toContainText("policy-platform");
  await expect(targets).toContainText("ep-users-list");
  await expect(targets).toContainText("ws-platform");
  await expect(targets).not.toContainText("ws-empty");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(dialog.locator(".sync-review-list")).toContainText("List users");
  await dialog.locator(".sync-confirm input").check();
  await dialog
    .getByRole("button", { name: "동기화 적용", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/resources?status=out-of-sync");
  await expect(table).not.toContainText("policy-platform");
  await expect(table).not.toContainText("ep-users-list");
  await expect(table).toContainText("ws-empty");
  await page.goto("/resources?history=policies:policy-platform");
  await expect(page.getByRole("dialog")).toContainText("revision 1");
  await expect(page.getByRole("dialog")).toContainText("ep-users-list");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.goto("/services");
  await expect(
    page.getByRole("link", { name: "Orion Identity API", exact: true }),
  ).toBeVisible();
});
