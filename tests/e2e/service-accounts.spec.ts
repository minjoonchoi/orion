import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("service accounts menu and list search, filters and sorting", async ({
  page,
}) => {
  await page.goto("/service-accounts");
  const table = page.getByRole("table", {
    name: "서비스 어카운트 목록",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await expect(
    page
      .locator("aside")
      .getByRole("link", { name: "서비스 어카운트", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByLabel("서비스 어카운트 목록 검색").fill(" SA-PLATFORM-CI ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.getByLabel("소속 조직 필터").selectOption("org-platform");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("상태 필터").selectOption("inactive");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.getByLabel("상태 필터").selectOption("inactive");
  await expect(table).toContainText("audit-export");
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  const header = page.getByRole("columnheader", {
    name: "API 키",
    exact: true,
  });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(table.locator("tbody tr").first()).toContainText("platform-ci");
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
});
test("organization account links, roles and API keys navigate to detail", async ({
  page,
}) => {
  await page.goto("/organizations/org-platform?tab=service-accounts");
  await page.getByRole("link", { name: "platform-ci", exact: true }).click();
  await expect(page).toHaveURL(/service-accounts\/sa-platform-ci$/);
  await expect(
    page.getByRole("heading", { name: "서비스 어카운트 정보", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "플랫폼개발팀", exact: true }).click();
  await expect(page).toHaveURL(/organizations\/org-platform$/);
  await page.goto("/service-accounts/sa-platform-ci?tab=roles");
  await expect(
    page
      .getByRole("table", { name: "역할 목록", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "플랫폼 관리자", exact: true }).click();
  await expect(page).toHaveURL(/roles\/role-platform$/);
  await page.goto("/service-accounts/sa-platform-ci");
  await page.getByRole("tab", { name: "API 키 (2)", exact: true }).click();
  await expect(page).toHaveURL(/tab=api-keys/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "API 키 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("키 상태 필터").selectOption("revoked");
  await expect(
    page
      .getByRole("table", { name: "API 키 목록", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "이전 CI 연동", exact: true }).click();
  await expect(page).toHaveURL(/api-keys\/key-old-ci$/);
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "API 키 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("empty associations, optional metadata and absent IDs", async ({
  page,
}) => {
  for (const tab of ["roles"]) {
    await page.goto(`/service-accounts/sa-audit-export?tab=${tab}`);
    await expect(
      page
        .getByRole("region", { name: "역할 목록 조회", exact: true })
        .getByRole("heading", { name: "항목이 없습니다" }),
    ).toBeVisible();
  }
  await page.goto("/service-accounts/sa-audit-export?tab=unknown");
  await expect(
    page.getByRole("tab", { name: "역할 (0)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("기록 없음", { exact: true })).toBeVisible();
  await page.goto("/service-accounts/sa-approval-bot?tab=api-keys");
  await expect(page.getByText("만료일 없음", { exact: true })).toBeVisible();
  await page.goto("/service-accounts/missing");
  await expect(
    page.getByRole("heading", { name: "서비스 어카운트를 찾을 수 없습니다" }),
  ).toBeVisible();
});
test("service account screens are accessible and fit mobile", async ({
  page,
}) => {
  for (const route of [
    "/service-accounts",
    "/service-accounts/sa-platform-ci",
    "/service-accounts/sa-platform-ci?tab=roles",
    "/service-accounts/sa-platform-ci?tab=api-keys",
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
