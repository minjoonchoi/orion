import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("resource menu, list filters, sort and pagination", async ({ page }) => {
  await page.goto("/services");
  await expect(
    page.locator("aside").getByRole("heading", { name: "리소스", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("서비스·화면", { exact: true })).toHaveCount(0);
  await page.getByLabel("상태 필터").selectOption("inactive");
  await expect(
    page.getByRole("table", { name: "서비스 목록", exact: true }),
  ).toContainText("정산 관리");
  await page.goto("/service-endpoints");
  const table = page.getByRole("table", {
    name: "서비스 엔드포인트 목록",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("2 / 2 페이지")).toBeVisible();
  await page.getByLabel("서비스 필터").selectOption("svc-approval");
  await page.getByLabel("HTTP 메서드 필터").selectOption("POST");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("결재 요청");
  await page.getByLabel("서비스 엔드포인트 목록 검색").fill(" /API/APPROVALS ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  const header = page.getByRole("columnheader", { name: "경로", exact: true });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await page.goto("/pages");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("2 / 2 페이지")).toBeVisible();
  await page.getByLabel("워크스페이스 필터").selectOption("ws-directory");
  await expect(
    page
      .getByRole("table", { name: "페이지 목록", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await page.getByLabel("페이지 목록 검색").fill("없는페이지");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
  await page.goto("/workspaces");
  await page.getByLabel("페이지 연결 필터").selectOption("empty");
  await expect(
    page
      .getByRole("table", { name: "워크스페이스 목록", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(1);
});
test("organization and policy links lead to service and endpoint details", async ({
  page,
}) => {
  await page.goto("/organizations/org-platform?tab=services");
  await page.getByRole("link", { name: "Orion", exact: true }).click();
  await expect(page).toHaveURL(/services\/svc-orion$/);
  await page.getByRole("tab", { name: "엔드포인트 (2)", exact: true }).click();
  await page.getByRole("link", { name: "역할 목록 조회", exact: true }).click();
  await expect(page).toHaveURL(/service-endpoints\/ep-roles$/);
  await page.getByRole("link", { name: "Orion", exact: true }).click();
  await expect(page).toHaveURL(/services\/svc-orion$/);
  await page.goto("/policies/policy-platform?tab=endpoints");
  await page.getByRole("link", { name: "정책 목록 조회", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "엔드포인트 정보", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("/api/policies", { exact: true })).toBeVisible();
  await page.goto("/policies/policy-platform?tab=services");
  await page.getByRole("link", { name: "Orion", exact: true }).click();
  await expect(page).toHaveURL(/services\/svc-orion$/);
});
test("workspace and page relations preserve detail tab URLs", async ({
  page,
}) => {
  await page.goto("/policies/policy-platform?tab=workspaces");
  await page.getByRole("link", { name: "플랫폼 운영", exact: true }).click();
  await page.getByRole("tab", { name: "페이지 (6)", exact: true }).click();
  await expect(page).toHaveURL(/tab=pages/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "페이지 (6)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "사용자 관리", exact: true }).click();
  await expect(page).toHaveURL(/pages\/page-users$/);
  await expect(page.getByText("/users", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "페이지 (6)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: "사용자 관리", exact: true }).click();
  await expect(page).toHaveURL(/pages\/page-users$/);
  await expect(
    page.getByRole("heading", { name: "페이지 정보", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "플랫폼 운영", exact: true }).click();
  await expect(page).toHaveURL(/workspaces\/ws-platform$/);
});
test("empty resources, invalid tabs, missing IDs and legacy route", async ({
  page,
}) => {
  for (const route of [
    "/services/svc-settlement?tab=endpoints",
    "/workspaces/ws-empty?tab=pages",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "연결된 항목이 없습니다" }),
    ).toBeVisible();
  }
  for (const route of ["/services/svc-orion", "/workspaces/ws-platform"]) {
    await page.goto(`${route}?tab=unknown`);
    await expect(
      page.getByRole("tab", { name: "기본 정보", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
  for (const route of [
    "services",
    "service-endpoints",
    "workspaces",
    "pages",
  ]) {
    await page.goto(`/${route}/missing`);
    await expect(
      page.getByRole("heading", { name: /찾을 수 없습니다/ }),
    ).toBeVisible();
  }
  await page.goto("/resources");
  await expect(page).toHaveURL(/\/services$/);
});
test("resource screens are accessible and contain mobile overflow", async ({
  page,
}) => {
  for (const route of [
    "/services",
    "/service-endpoints",
    "/workspaces",
    "/pages",
    "/services/svc-orion?tab=endpoints",
    "/service-endpoints/ep-roles",
    "/workspaces/ws-platform?tab=pages",
    "/pages/page-users",
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
