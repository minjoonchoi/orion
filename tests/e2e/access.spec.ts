import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("platform roles search, filter, sort and paginate", async ({ page }) => {
  await page.goto("/roles");
  const region = page.getByRole("region", {
    name: "플랫폼 역할 목록 조회",
    exact: true,
  });
  const table = region.getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await region.getByRole("button", { name: "다음", exact: true }).click();
  await expect(region.getByText("2 / 2 페이지")).toBeVisible();
  await region.getByRole("searchbox").fill(" 플랫폼 관리자 ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await region.getByRole("button", { name: "초기화", exact: true }).click();
  const header = region.getByRole("columnheader", {
    name: "역할",
    exact: true,
  });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await region.getByLabel("플랫폼 필터").selectOption("finance");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("정산 검토자");
  await region.getByRole("searchbox").fill("없는결과");
  await expect(
    region.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
});
test("role associations match user and organization links and open policy details", async ({
  page,
}) => {
  await page.goto("/users/usr-001?tab=roles");
  await page.getByRole("link", { name: "플랫폼 관리자", exact: true }).click();
  await expect(page).toHaveURL(/roles\/role-platform$/);
  await page.getByRole("tab", { name: "사용자 (1)", exact: true }).click();
  await page.getByRole("link", { name: "김가람", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-001\?tab=roles$/);
  await page.goto("/roles/role-platform?tab=organizations");
  await page.getByRole("link", { name: "플랫폼개발팀", exact: true }).click();
  await page.getByRole("tab", { name: "역할 (2)", exact: true }).click();
  await page.getByRole("link", { name: "플랫폼 관리자", exact: true }).click();
  await page.getByRole("tab", { name: "정책 (2)", exact: true }).click();
  await page
    .getByRole("link", { name: "인사 사용자 상세 조회", exact: true })
    .click();
  await expect(page).toHaveURL(/policies\/policy-platform$/);
  await expect(
    page.getByRole("heading", { name: "인사 사용자 상세 조회", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "/email" }),
  ).toContainText("마스킹");
});
test("empty associations, invalid tabs and absent records", async ({
  page,
}) => {
  for (const [route, tabs] of [
    ["roles/role-unassigned", ["users", "organizations", "policies"]],
  ] as const) {
    for (const tab of tabs) {
      await page.goto(`/${route}?tab=${tab}`);
      await expect(
        page.getByRole("heading", { name: "항목이 없습니다" }),
      ).toBeVisible();
    }
    await page.goto(`/${route}?tab=unknown`);
    await expect(
      page.getByRole("tab", { name: "사용자 (0)", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
  for (const route of ["roles", "policies"]) {
    await page.goto(`/${route}/missing`);
    await expect(
      page.getByRole("heading", { name: /찾을 수 없습니다/ }),
    ).toBeVisible();
  }
});
test("access pages are accessible and contained on mobile", async ({
  page,
}) => {
  for (const route of [
    "/roles",
    "/policies",
    "/roles/role-viewer?tab=users",
    "/policies/policy-platform",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});
