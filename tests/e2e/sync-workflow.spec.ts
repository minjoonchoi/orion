import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("detail and multi-select use the same two steps and only selected resources are applied", async ({
  page,
}) => {
  await page.goto("/services/svc-orion");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("table", { name: "Sync 대상" }).locator("tbody tr"),
  ).toHaveCount(1);
  await expect(dialog).toContainText("svc-orion");
  await expect(dialog).not.toContainText("ws-platform");
  await dialog
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "최종 Sync 적용" }),
  ).toBeDisabled();
  await expect(dialog.locator(".impact-scope li")).toHaveCount(1);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.goto("/resources?type=services");
  await page
    .getByRole("row")
    .filter({ hasText: "svc-orion" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("workspaces");
  await page
    .getByRole("row")
    .filter({ hasText: "ws-platform" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "선택 리소스 Sync", exact: true })
    .click();
  await expect(
    dialog.getByRole("table", { name: "Sync 대상" }).locator("tbody tr"),
  ).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  await expect(dialog.locator(".impact-scope li")).toHaveCount(2);
  await dialog.getByRole("checkbox").last().check();
  await dialog.getByRole("button", { name: "최종 Sync 적용" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await page.goto("/resources?status=out-of-sync");
  const catalog = page.getByRole("table", { name: "리소스 관리" });
  await expect(catalog).not.toContainText("svc-orion");
  await expect(catalog).not.toContainText("ws-platform");
  await expect(catalog.locator("tbody tr")).toHaveCount(3);
});

test("policy Sync includes dependencies, previews role-based users and organizations, then commits one revision", async ({
  page,
}) => {
  await page.goto("/policies/sync");
  const card = page
    .locator(".sync-diffs > details")
    .filter({ hasText: "policy-platform" });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "이 정책 Sync" }).click();
  const dialog = page.getByRole("dialog");
  const targets = dialog.getByRole("table", { name: "Sync 대상" });
  await expect(targets.locator("tbody tr")).toHaveCount(5);
  for (const id of ["svc-orion", "ep-roles", "page-users", "ws-platform"])
    await expect(targets).toContainText(id);
  await expect(targets).not.toContainText("ep-users-list");
  await expect(targets).not.toContainText("ws-empty");
  await expect(targets).toContainText("필수 상위 리소스");
  await dialog
    .getByRole("button", { name: "변경·영향도 검토", exact: true })
    .click();
  const impact = dialog.locator(".sync-workflow-impact");
  await expect(
    impact.getByRole("button", { name: "사용자 1", exact: true }),
  ).toBeVisible();
  await expect(
    impact.getByRole("button", { name: "조직 1", exact: true }),
  ).toBeVisible();
  await impact
    .getByRole("button", { name: "서비스 어카운트 1", exact: true })
    .click();
  const account = impact.locator(".subject-row");
  await expect(account).toContainText("platform-ci");
  await account.locator("summary").first().click();
  await expect(account.locator(".subject-path-chain")).toContainText(
    "플랫폼 관리자",
  );
  await expect(account.locator(".subject-path-chain")).toContainText(
    "플랫폼 조회",
  );
  await expect(dialog.locator(".sync-review-list > details")).toHaveCount(4);
  await dialog.locator(".sync-confirm input").check();
  await dialog.getByRole("button", { name: "최종 Sync 적용" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("revision 1", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/resources?status=out-of-sync");
  const catalog = page.getByRole("table", { name: "리소스 관리" });
  await expect(catalog.locator("tbody tr")).toHaveCount(2);
  await expect(catalog).toContainText("ep-users-list");
  await expect(catalog).toContainText("ws-empty");
  await page.goto("/resources?history=services:svc-orion");
  await expect(page.locator(".sync-history-entry")).toHaveCount(2);
  await expect(page.getByRole("dialog")).toContainText("revision 1");
});

test("English mobile Sync stages stay accessible and cancellation does not apply", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services/svc-orion");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("table", { name: "Sync targets" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog
    .getByRole("button", { name: "Review changes & impact", exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Back to targets" }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".access-entry")).toContainText("revision 0");
});
