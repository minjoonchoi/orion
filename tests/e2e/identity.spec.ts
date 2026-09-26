import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("users search, filters, sorting and pagination", async ({ page }) => {
  await page.goto("/users");
  const table = page.getByRole("table", { name: "사용자 목록", exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("2 / 3 페이지")).toBeVisible();
  await page.getByLabel("사용자 목록 검색").fill(" MEMBER1@EXAMPLE.TEST ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await page.getByLabel("재직 상태 필터").selectOption("on_leave");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("소속 조직 필터").selectOption("org-platform");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("사용자 목록 검색").fill("없는사람");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  const header = page.getByRole("columnheader", { name: /닉네임/ });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(table.locator("tbody tr").first()).toContainText("한지우");
});
test("user and organization details link together and tabs survive navigation", async ({
  page,
}) => {
  await page.goto("/users/usr-001");
  await expect(
    page.getByRole("heading", { name: "김가람", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "소속 조직 목록", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "역할 (2)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "역할 목록", exact: true }),
  ).toContainText("플랫폼 관리자");
  await expect(page.getByText("소유 API 키", { exact: true })).toHaveCount(0);
  await expect(page.getByText("재직", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "소속 조직 (2)", exact: true }).click();
  await page.getByRole("link", { name: "플랫폼개발팀", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "플랫폼개발팀", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "멤버 (7)", exact: true }).click();
  await expect(
    page
      .getByRole("table", { name: "멤버 목록", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(5);
  await page
    .getByRole("tab", { name: "서비스 어카운트 (2)", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "서비스 어카운트 목록", exact: true }),
  ).toContainText("directory-sync");
  await page.getByRole("tab", { name: "관리 서비스 (2)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "관리 서비스 목록", exact: true }),
  ).toContainText("Orion");
  await page.getByRole("tab", { name: "역할 (2)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "역할 목록", exact: true }),
  ).toContainText("플랫폼 관리자");
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "역할 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "관리 서비스 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "멤버 (7)", exact: true }).click();
  await page
    .getByRole("table", { name: "멤버 목록", exact: true })
    .getByRole("link", { name: "김가람", exact: true })
    .click();
  await expect(page).toHaveURL(/users\/usr-001$/);
});
test("organizations filters, empty relationships and missing IDs", async ({
  page,
}) => {
  await page.goto("/organizations");
  await page.getByLabel("상태 필터").selectOption("inactive");
  await expect(
    page
      .getByRole("table", { name: "조직 목록", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await page
    .getByRole("link", { name: "프로젝트 아카이브", exact: true })
    .click();
  await page.getByRole("tab", { name: "멤버 (0)", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "항목이 없습니다" }).first(),
  ).toBeVisible();
  await page.goto("/users/usr-014?tab=organizations");
  await expect(
    page.getByRole("heading", { name: "항목이 없습니다" }).first(),
  ).toBeVisible();
  for (const route of ["users", "organizations"]) {
    await page.goto(`/${route}/not-an-id`);
    await expect(
      page.getByRole("heading", { name: /찾을 수 없습니다/ }),
    ).toBeVisible();
  }
});
test("identity views are accessible on desktop and narrow screens", async ({
  page,
}) => {
  for (const route of [
    "/users",
    "/organizations",
    "/users/usr-001?tab=roles",
    "/organizations/org-platform?tab=members",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});

test("organization leaders, parents and service account key links", async ({
  page,
}) => {
  await page.goto("/organizations");
  const table = page.getByRole("table", { name: "조직 목록", exact: true });
  await expect(
    table.getByRole("columnheader", { name: "관리 서비스", exact: true }),
  ).toHaveCount(0);
  await expect(
    table.getByRole("columnheader", { name: "조직장", exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "상위 조직", exact: true }),
  ).toBeVisible();
  await table.getByRole("link", { name: "김가람", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-001/);
  await page.goto("/organizations/org-platform?tab=service-accounts");
  await page
    .getByRole("table", { name: "서비스 어카운트 목록", exact: true })
    .getByRole("link", { name: "directory-sync", exact: true })
    .click();
  await expect(page).toHaveURL(/service-accounts\/sa-directory-sync/);
  await page.goto("/users");
  await page
    .getByRole("table", { name: "사용자 목록", exact: true })
    .locator("tbody tr")
    .first()
    .getByRole("link", { name: "2개", exact: true })
    .click();
  await expect(page).toHaveURL(/users\/usr-001\?tab=roles/);
  await expect(
    page.getByRole("table", { name: "역할 목록", exact: true }),
  ).toContainText("플랫폼 관리자");
});
