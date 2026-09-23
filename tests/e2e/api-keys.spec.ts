import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("API key list searches, filters, sorts and paginates", async ({
  page,
}) => {
  await page.goto("/api-keys");
  const table = page.getByRole("table", { name: "API 키 목록", exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("2 / 2 페이지")).toBeVisible();
  await page.getByLabel("API 키 목록 검색").fill(" KEY-DIRECTORY ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.getByLabel("키 상태 필터").selectOption("revoked");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("소속 조직 필터").selectOption("org-finance");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("정산 리포트");
  await page.getByLabel("API 키 목록 검색").fill("없는키");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  const header = page.getByRole("columnheader", {
    name: "발급일 (한국 시간)",
    exact: true,
  });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(table.locator("tbody tr").first()).toContainText(
    "제품 지표 조회",
  );
});
test("API key metadata links to owner and organization and handles optional dates", async ({
  page,
}) => {
  await page.goto("/api-keys");
  await page
    .getByRole("link", { name: "디렉터리 동기화", exact: true })
    .click();
  await expect(page.getByText("•••• a001", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "김가람", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-001$/);
  await page.goBack();
  await page.getByRole("link", { name: "플랫폼개발팀", exact: true }).click();
  await expect(page).toHaveURL(/organizations\/org-platform$/);
  await page.goto("/api-keys/key-approval");
  await expect(page.getByText("만료일 없음", { exact: true })).toBeVisible();
  await expect(page.getByText("기록 없음", { exact: true })).toBeVisible();
  await page.goto("/api-keys/key-finance");
  await expect(page.locator("dd").filter({ hasText: "폐기" })).toHaveCount(1);
});
test("approval history filters, paginates, restores tabs and shows decision metadata", async ({
  page,
}) => {
  await page.goto("/api-keys/key-directory");
  await page.getByRole("tab", { name: "결재 이력 (6)", exact: true }).click();
  await expect(page).toHaveURL(/tab=approvals/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "결재 이력 (6)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const table = page.getByRole("table", {
    name: "결재 이력 목록",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await expect(table.locator("tbody tr").first()).toContainText("approval-006");
  await page
    .getByRole("region", { name: "결재 이력 목록 조회", exact: true })
    .getByRole("button", { name: "다음", exact: true })
    .click();
  await expect(table).toContainText("approval-001");
  await page.getByLabel("결재 상태 필터").selectOption("pending");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("미처리");
  await expect(table).toContainText("미지정");
  await page
    .getByRole("region", { name: "결재 이력 목록 조회", exact: true })
    .getByRole("button", { name: "초기화", exact: true })
    .click();
  await page.getByLabel("결재 상태 필터").selectOption("rejected");
  await page.getByLabel("요청 유형 필터").selectOption("renew");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("필요 기간을 구체적으로 작성해 주세요.");
  await page.getByRole("link", { name: "서도윤", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-006$/);
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "결재 이력 (6)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
test("empty history, missing key, invalid tab, accessibility and mobile", async ({
  page,
}) => {
  await page.goto("/api-keys/key-product?tab=approvals");
  await expect(
    page.getByRole("heading", { name: "결재 이력이 없습니다" }),
  ).toBeVisible();
  await page.goto("/api-keys/missing");
  await expect(
    page.getByRole("heading", { name: "API 키를 찾을 수 없습니다" }),
  ).toBeVisible();
  await page.goto("/api-keys/key-directory?tab=unknown");
  await expect(
    page.getByRole("tab", { name: "기본 정보", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  for (const route of [
    "/api-keys",
    "/api-keys/key-directory",
    "/api-keys/key-directory?tab=approvals",
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
