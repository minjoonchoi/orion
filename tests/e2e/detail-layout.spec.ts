import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const routes = [
  "/users/usr-001",
  "/organizations/org-platform",
  "/roles/role-platform",
  "/service-accounts/sa-directory-sync",
  "/api-keys/key-directory",
  "/approval-templates/api-key-issue",
  "/workspaces/platform",
  "/pages/platform~user-detail",
  "/services/identity-api",
  "/service-endpoints/identity-api~detail",
  "/domains/identity",
  "/actions/identity~read-hr",
  "/policies/policy-platform",
];
for (const route of routes) {
  test(`common detail summary and tabs: ${route}`, async ({ page }) => {
    await page.goto(route);
    const summary = page.locator("[data-detail-summary]");
    await expect(summary).toBeVisible();
    const text = await summary.innerText();
    await expect(page.getByRole("tablist")).toHaveCount(1);
    await expect(
      page.getByRole("tab", { name: "기본 정보", exact: true }),
    ).toHaveCount(0);
    const tabs = page.getByRole("tab");
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true");
      await expect(summary).toBeVisible();
      expect(await summary.innerText()).toBe(text);
      await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    }
    const selected = await page
      .getByRole("tab", { selected: true })
      .innerText();
    await page.reload();
    await expect(page.getByRole("tab", { selected: true })).toHaveText(
      selected,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("tab state, history, empty roles, localized labels and accessibility", async ({
  page,
}) => {
  await page.goto("/users/usr-001?tab=roles");
  await expect(
    page.getByRole("button", { name: "역할 부여", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "소속 조직 (2)", exact: true }).click();
  await expect(page).toHaveURL(/tab=organizations/);
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "역할 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/users/usr-014?tab=roles");
  await expect(
    page.getByRole("heading", { name: "항목이 없습니다", exact: true }),
  ).toBeVisible();
  await page.goto("/organizations/org-platform?tab=api-keys");
  await expect(page.getByRole("tab", { name: /^조직 API 키/ })).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "서비스 어카운트 (2)", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("table", { name: "서비스 어카운트 목록", exact: true }),
  ).toContainText("directory-sync");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .context()
    .addCookies([
      { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
    ]);
  await page.reload();
  await expect(page.getByRole("tab", { selected: true })).not.toContainText(
    "조직",
  );
  await page.goto("/approvals/approval-demo-001");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(1);
});
