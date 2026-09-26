import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("inverse relationships open the correct detail pages", async ({
  page,
}) => {
  const cases = [
    [
      "/roles/role-platform?tab=service-accounts",
      "서비스 어카운트 목록",
      "platform-ci",
      "/service-accounts/sa-platform-ci?tab=roles",
    ],
    [
      "/api-keys/key-directory?tab=service-accounts",
      "서비스 어카운트",
      "directory-sync",
      "/service-accounts/sa-directory-sync",
    ],

    [
      "/approval-templates/api-key-issue?tab=approvals",
      "결재 목록",
      "API 키 발급 · directory-sync",
      "/approvals/approval-demo-001",
    ],
  ];
  for (const [source, title, label, target] of cases) {
    await page.goto(source);
    const region = page.getByRole("region", {
      name: `${title} 조회`,
      exact: true,
    });
    await region.getByRole("searchbox").fill(label);
    await region.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname + url.search === target);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
test("relationship counts open the corresponding tab", async ({ page }) => {
  const cases = [
    ["/users", "김가람", "2개", "/users/usr-001?tab=roles"],
    [
      "/organizations",
      "플랫폼개발팀",
      "7명",
      "/organizations/org-platform?tab=members",
    ],
    ["/roles", "플랫폼 관리자", "1명", "/roles/role-platform?tab=users"],
  ];
  for (const [source, name, count, target] of cases) {
    await page.goto(source);
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name, exact: true }) })
      .first();
    await row.getByRole("link", { name: count, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname + url.search === target);
    await expect(page.getByRole("tab", { selected: true })).not.toHaveText(
      "기본 정보",
    );
  }
  await page.goto("/service-accounts");
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "platform-ci", exact: true }),
  });
  await row.getByRole("link").filter({ hasText: "2개" }).last().click();
  await expect(page).toHaveURL(/sa-platform-ci\?tab=api-keys$/);
});
test("related lists support keyboard navigation, empty state and narrow screens", async ({
  page,
}) => {
  await page.goto("/roles/role-unassigned?tab=service-accounts");
  await expect(
    page
      .getByRole("region", { name: "서비스 어카운트 목록 조회" })
      .getByRole("heading", { name: "항목이 없습니다" }),
  ).toBeVisible();
  await page.goto("/roles/role-platform?tab=service-accounts");
  const link = page
    .getByRole("region", { name: "서비스 어카운트 목록 조회" })
    .getByRole("link", { name: "platform-ci", exact: true });
  await link.focus();
  await link.press("Enter");
  await expect(page).toHaveURL(/service-accounts\/sa-platform-ci\?tab=roles$/);
  await page.goBack();
  await expect(page).toHaveURL(/roles\/role-platform\?tab=service-accounts$/);
  for (const route of [
    "/users/usr-001",
    "/approval-templates/api-key-issue?tab=approvals",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("tablist")).toBeVisible();
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
