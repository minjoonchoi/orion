import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("selected impact spans filters, survives reload, and can narrow to one resource", async ({
  page,
}) => {
  await page.goto("/resources?type=services");
  await expect(
    page.getByRole("button", { name: "선택 리소스 영향도 검토" }),
  ).toBeDisabled();
  await page
    .getByRole("row")
    .filter({ hasText: "svc-orion" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("workspaces");
  await page
    .getByRole("row")
    .filter({ hasText: "ws-platform" })
    .getByRole("checkbox")
    .check();
  await page.reload();
  await expect(page.getByRole("region", { name: "리소스 선택" })).toContainText(
    "선택한 리소스 · 2",
  );
  await expect(page.getByRole("region", { name: "리소스 선택" })).toContainText(
    "현재 필터 밖 선택 · 1",
  );
  await page.getByRole("button", { name: "선택 리소스 영향도 검토" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".impact-scope li")).toHaveCount(2);
  await expect(dialog.locator(".impact-scope")).toContainText("svc-orion");
  await expect(dialog.locator(".impact-scope")).toContainText("ws-platform");
  await expect(dialog.locator(".subject-counts > div")).toHaveCount(3);
  await expect(dialog.getByRole("button", { name: "동기화 적용" })).toHaveCount(
    0,
  );
  await dialog
    .getByRole("combobox", { name: "영향도 조회 범위" })
    .selectOption("services:svc-orion");
  await expect(dialog.locator(".impact-scope li")).toHaveCount(1);
  await expect(dialog.locator(".impact-scope")).not.toContainText(
    "ws-platform",
  );
  await expect(dialog.locator(".subject-counts > div")).toHaveCount(3);
  await dialog
    .getByRole("combobox", { name: "영향도 조회 범위" })
    .selectOption("all");
  await expect(dialog.locator(".subject-counts > div")).toHaveCount(3);
  await dialog.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "ws-platform" })
    .getByRole("button", { name: /영향도 검토/ })
    .click();
  await expect(dialog.locator(".impact-scope li")).toHaveCount(1);
  await expect(dialog.locator(".impact-scope")).toContainText("ws-platform");
  await expect(dialog.locator(".impact-scope")).not.toContainText("svc-orion");
  await dialog.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await expect(page.getByRole("region", { name: "리소스 선택" })).toContainText(
    "선택한 리소스 · 2",
  );
});

test("resource detail opens impact scoped to that resource", async ({
  page,
}) => {
  await page.goto("/services/svc-orion");
  await page.getByRole("button", { name: "영향도 검토", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".impact-scope li"),
  ).toHaveCount(1);
  await expect(page.getByRole("dialog").locator(".impact-scope")).toContainText(
    "svc-orion",
  );
});

test("page selection, clearing, and English mobile impact remain scoped and accessible", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/resources?type=services");
  const rows = page
    .getByRole("table", { name: "Change management" })
    .locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  await page
    .getByRole("checkbox", { name: "Select resources on this page" })
    .check();
  await expect(
    page.getByRole("region", { name: "Select resources" }),
  ).toContainText(`Selected resources · ${count}`);
  await page
    .getByRole("button", { name: "Review selected resource impact" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".impact-scope li")).toHaveCount(count);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Back to list" }).click();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review selected resource impact" }),
  ).toBeDisabled();
});
