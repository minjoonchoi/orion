import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("approval template menu, search, filters and detail", async ({ page }) => {
  await page.goto("/approval-templates");
  await expect(
    page.locator("aside").getByRole("heading", { name: "결재", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table", {
    name: "결재 템플릿 목록",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await page
    .getByLabel("결재 템플릿 목록 검색")
    .fill(" TEMPLATE-KEY-RENEW-V1 ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.getByLabel("템플릿 상태 필터").selectOption("inactive");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("link", { name: "이전 API 키 발급", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "결재 템플릿 정보", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("사용 중지", { exact: true })).toBeVisible();
  await expect(
    page
      .locator("aside")
      .getByRole("link", { name: "결재 템플릿", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/approval-templates");
  await page.getByLabel("요청 유형 필터").selectOption("renew");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("결재 템플릿 목록 검색").fill("없는템플릿");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
});
test("approval list pagination, filters, sorting and search", async ({
  page,
}) => {
  await page.goto("/approvals");
  const table = page.getByRole("table", { name: "결재 목록", exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await expect(table.locator("tbody tr").first()).toContainText("approval-006");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("2 / 2 페이지")).toBeVisible();
  await page.getByLabel("결재 상태 필터").selectOption("rejected");
  await page.getByLabel("요청 유형 필터").selectOption("renew");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("approval-002");
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page
    .getByLabel("결재 템플릿 필터")
    .selectOption("template-key-issue-v1");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("결재 목록 검색").fill(" APPROVAL-007 ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  const header = page.getByRole("columnheader", {
    name: "요청일",
    exact: true,
  });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(table.locator("tbody tr").first()).toContainText("approval-001");
});
test("API key history opens approval detail and links to template, key and people", async ({
  page,
}) => {
  await page.goto("/api-keys/key-directory?tab=approvals");
  await page.getByRole("link", { name: "approval-006", exact: true }).click();
  await expect(page).toHaveURL(/approvals\/approval-006$/);
  await expect(
    page.getByRole("heading", { name: "결재 정보", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("미처리", { exact: true })).toBeVisible();
  await expect(page.getByText("미지정", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "API 키 폐기 · v1", exact: true })
    .click();
  await expect(page).toHaveURL(/approval-templates\/template-key-revoke-v1$/);
  await expect(
    page.getByRole("heading", { name: "결재 템플릿 정보", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "결재 정보", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "디렉터리 동기화", exact: true })
    .click();
  await expect(page).toHaveURL(/api-keys\/key-directory$/);
  await page.goto("/approvals/approval-002");
  await expect(
    page.getByText("필요 기간을 구체적으로 작성해 주세요.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "서도윤", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-006$/);
});
test("missing approval records, accessibility and mobile", async ({ page }) => {
  for (const route of ["approval-templates", "approvals"]) {
    await page.goto(`/${route}/missing`);
    await expect(
      page.getByRole("heading", { name: /찾을 수 없습니다/ }),
    ).toBeVisible();
  }
  for (const route of [
    "/approval-templates",
    "/approval-templates/template-key-issue-v1",
    "/approvals",
    "/approvals/approval-006",
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
