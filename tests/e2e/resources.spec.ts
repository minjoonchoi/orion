import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("workspace and service children expose scoped links and persistent tabs", async ({
  page,
}) => {
  await page.goto("/workspaces/platform");
  await page
    .getByRole("link", { name: /인사 사용자 상세/ })
    .first()
    .click();
  await expect(page).toHaveURL(/pages\/platform~user-detail/);
  await page.getByRole("tab", { name: /^관계 \(/ }).click();
  await page.reload();
  await expect(page.getByRole("tab", { name: /^관계 \(/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goto("/services/identity-api");
  await page
    .getByRole("link", { name: /사용자 기본 정보 조회/ })
    .first()
    .click();
  await expect(page).toHaveURL(/identity-api~detail$/);
});
test("resource catalogs filter by search and do not overflow on mobile", async ({
  page,
}) => {
  await page.goto("/service-endpoints");
  await page
    .getByRole("textbox", { name: "리소스 검색", exact: true })
    .fill("directory-api");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "리소스 검색", exact: true })
    .fill("no-such-resource");
  await expect(
    page.getByText("검색 결과가 없습니다", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("unqualified ambiguous endpoint IDs never resolve globally", async ({
  page,
}) => {
  await page.goto("/service-endpoints/detail");
  await expect(
    page.getByRole("heading", { name: "항목을 찾을 수 없습니다" }),
  ).toBeVisible();
  await page.goto("/resource-sync");
  await expect(page).toHaveURL(/\/resources$/);
});
