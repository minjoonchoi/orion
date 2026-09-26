import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("templates describe issuance and replacement lines and allow catalog editing", async ({
  page,
}) => {
  await page.goto("/approval-templates");
  const table = page.getByRole("table", {
    name: "결재 템플릿 목록",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await table.getByRole("link", { name: "API 키 발급", exact: true }).click();
  await expect(page.getByText("보안팀 합의", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "템플릿 수정", exact: true }).click();
  const dialog = page.locator("main");
  await expect(dialog.getByLabel("담당 대상").first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByLabel("이름", { exact: true }).fill("새 발급 템플릿");
  await dialog
    .getByRole("button", { name: "새 버전 저장", exact: true })
    .click();
  await expect(page).toHaveURL(/approval-templates\/api-key-issue$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "새 발급 템플릿",
  );
  await page.goto("/approvals/approval-demo-001");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "API 키 발급 · directory-sync",
  );
  await page.goto("/approval-templates/api-key-replace");
  await expect(page.getByText("보안팀 합의", { exact: true })).toHaveCount(0);
});
test("document visibility is determined by viewers, including list and direct URL", async ({
  page,
}) => {
  await page.goto("/approvals");
  await expect(
    page.getByRole("table", { name: "결재 목록", exact: true }),
  ).toContainText("approval-demo-001");
  await page.getByLabel("데모 사용자", { exact: true }).selectOption("usr-014");
  await expect(page.locator(".wf-demo")).toHaveAttribute(
    "data-actor-id",
    "usr-014",
  );
  await expect(
    page.getByRole("link", {
      name: "API 키 발급 · directory-sync",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/approvals/approval-demo-001");
  await expect(page).toHaveURL(/forbidden/);
});
test("approval detail and request form are accessible", async ({ page }) => {
  for (const path of [
    "/approvals/approval-demo-001?tab=line",
    "/approvals/new",
    "/approvals/new?template=api-key-issue",
    "/approval-templates/new",
    "/approval-templates/api-key-issue/edit",
    "/approval-templates/api-key-issue?tab=fields",
  ]) {
    await page.goto(path);
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
