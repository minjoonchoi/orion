import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("unified resource catalog and legacy type filters", async ({ page }) => {
  for (const kind of ["services", "service-endpoints", "workspaces", "pages"]) {
    await page.goto("/" + kind);
    await expect(page).toHaveURL(new RegExp("resources\\?type=" + kind));
    await expect(
      page.getByRole("combobox", { name: "리소스 유형", exact: true }),
    ).toHaveValue(kind);
    await expect(page.locator(".sync-catalog tbody tr").first()).toBeVisible();
  }
  await page.goto("/resources");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page
    .getByLabel("리소스 검색", { exact: true })
    .fill("no-resource-found");
  await expect(page.locator(".sync-catalog")).toContainText(
    "검색 결과가 없습니다",
  );
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
  await expect(page).toHaveURL(/\/resources$/);
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
