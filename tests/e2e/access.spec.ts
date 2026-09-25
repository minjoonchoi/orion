import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("role and policy lists search, filter, sort and paginate", async ({
  page,
}) => {
  for (const route of ["roles", "policies"]) {
    const title = route === "roles" ? "역할 목록" : "정책 목록";
    await page.goto(`/${route}`);
    const table = page.getByRole("table", { name: title, exact: true });
    await expect(table.locator("tbody tr")).toHaveCount(5);
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(page.getByText("2 / 2 페이지")).toBeVisible();
    await page
      .getByLabel(`${title} 검색`)
      .fill(route === "roles" ? " ROLE-PLATFORM " : " POLICY-PLATFORM ");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "초기화", exact: true }).click();
    const header = page.getByRole("columnheader", {
      name: "이름",
      exact: true,
    });
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await page
      .getByLabel(route === "roles" ? "정책 연결 필터" : "리소스 연결 필터")
      .selectOption("empty");
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table).toContainText("미연결");
    await page.getByLabel(`${title} 검색`).fill("없는결과");
    await expect(
      page.getByRole("heading", { name: "검색 결과가 없습니다" }),
    ).toBeVisible();
  }
});
test("role associations match user and organization links and open policy details", async ({
  page,
}) => {
  await page.goto("/users/usr-001?tab=roles");
  await page.getByRole("link", { name: "플랫폼 관리자", exact: true }).click();
  await expect(page).toHaveURL(/roles\/role-platform$/);
  await page.getByRole("tab", { name: "사용자 (1)", exact: true }).click();
  await page.getByRole("link", { name: "김가람", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-001$/);
  await page.goto("/roles/role-platform?tab=organizations");
  await page.getByRole("link", { name: "플랫폼개발팀", exact: true }).click();
  await page.getByRole("tab", { name: "역할 (2)", exact: true }).click();
  await page.getByRole("link", { name: "플랫폼 관리자", exact: true }).click();
  await page.getByRole("tab", { name: "정책 (2)", exact: true }).click();
  await page.getByRole("link", { name: "플랫폼 조회", exact: true }).click();
  await expect(page).toHaveURL(/policies\/policy-platform$/);
  await page.getByRole("tab", { name: "서비스 (1)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "서비스 목록", exact: true }),
  ).toContainText("Orion");
  await page.getByRole("tab", { name: "엔드포인트 (2)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "서비스 엔드포인트 목록", exact: true }),
  ).toContainText("/api/roles");
  await page.getByLabel("HTTP 메서드 필터").selectOption("POST");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "워크스페이스 (1)", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "워크스페이스 목록", exact: true }),
  ).toContainText("플랫폼 운영");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "워크스페이스 (1)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "엔드포인트 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("empty associations, invalid tabs and absent records", async ({
  page,
}) => {
  for (const [route, tabs] of [
    ["roles/role-unassigned", ["users", "organizations", "policies"]],
    ["policies/policy-unassigned", ["services", "endpoints", "workspaces"]],
  ] as const) {
    for (const tab of tabs) {
      await page.goto(`/${route}?tab=${tab}`);
      await expect(
        page.getByRole("heading", { name: "연결된 항목이 없습니다" }),
      ).toBeVisible();
    }
    await page.goto(`/${route}?tab=unknown`);
    await expect(
      page.getByRole("tab", { name: "기본 정보", exact: true }),
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
    "/policies/policy-security?tab=endpoints",
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
