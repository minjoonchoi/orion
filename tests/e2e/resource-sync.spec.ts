import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("GitOps diff, explicit review, apply and catalog projection", async ({
  page,
}) => {
  await page.goto("/resource-sync");
  await expect(page.getByText("revision 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "리소스 관리" })).toBeVisible();
  await page
    .getByLabel("리소스 유형", { exact: true })
    .selectOption("services");
  await expect(page.locator(".sync-catalog")).toContainText("Out of sync");
  await page
    .getByRole("link", { name: /diff 확인/ })
    .first()
    .click();
  await expect(page.locator("#resource-diff")).toContainText(
    "Orion Identity API",
  );
  await page.getByRole("button", { name: /Sync · 영향도 검토/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "최종 Sync 적용" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("columnheader", { name: "Synced", exact: true }).first(),
  ).toBeVisible();
  await expect(dialog).toContainText("변경 리소스");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "최종 Sync 적용" }).click();
  await expect(page.getByRole("status")).toContainText("succeeded");
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sync · 영향도 검토/ }),
  ).toBeDisabled();
  await page.goto("/workspaces");
  await expect(page.locator("a[href='/workspaces/ws-empty']")).toHaveCount(0);
  await page.goto("/services/svc-orion");
  await expect(
    page.getByRole("heading", { name: "Orion Identity API", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "리소스 수정과 영향 범위" }),
  ).toHaveCount(0);
  await page.goto("/service-endpoints/ep-users-list");
  await expect(
    page.getByRole("heading", { name: "List users", exact: true }),
  ).toBeVisible();
});
test("review cancel never writes DB; English mobile controls are accessible", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/resource-sync");
  await page.getByRole("button", { name: /Sync · Review impact/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Back", exact: true })
    .click();
  await expect(page.getByText("revision 0", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("stale preview cannot apply after another permission change", async ({
  page,
  context,
}) => {
  await page.goto("/resource-sync");
  await page.getByRole("button", { name: /Sync · 영향도 검토/ }).click();
  const other = await context.newPage();
  await other.goto("/users/usr-014");
  await other.getByRole("button", { name: "역할 부여", exact: true }).click();
  const edit = other.getByRole("dialog");
  await edit
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .check();
  await edit
    .getByRole("button", { name: "변경사항 검토", exact: true })
    .click();
  await edit.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(edit.getByRole("status")).toContainText(
    "변경사항을 적용했습니다",
  );
  const review = page.getByRole("dialog");
  await review.getByRole("checkbox").check();
  await review
    .getByRole("button", { name: "최종 Sync 적용", exact: true })
    .click();
  await expect(review.getByRole("alert")).toContainText(
    "버전이 변경되었습니다",
  );
  await review.getByRole("button", { name: "돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sync · 영향도 검토/ }),
  ).toBeEnabled();
  await other.close();
});

test("unified catalog filters, detail diff links and persistent session history", async ({
  page,
}) => {
  await page.goto("/resources");
  await expect(
    page.getByRole("heading", { name: "리소스 관리", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("services");
  await expect(page.locator(".sync-catalog tbody")).toContainText("svc-orion");
  await expect(page.locator(".sync-catalog tbody")).not.toContainText(
    "ws-platform",
  );
  await page.locator(".sync-catalog a[href='/services/svc-orion']").click();
  await page
    .getByRole("link", { name: "변경 예정 · diff 확인", exact: true })
    .click();
  await expect(page.locator(".sync-diffs > details")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Sync · 영향도 검토 · 5", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sync · 영향도 검토 · 5", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".sync-review-list > section")).toHaveCount(5);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "최종 Sync 적용" }).click();
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await page.goto("/resource-sync/history");
  await expect(page.locator(".sync-catalog tbody tr")).toHaveCount(1);
  await expect(page.locator(".sync-catalog tbody")).toContainText("revision 1");
  await page.reload();
  await expect(page.locator(".sync-catalog tbody tr")).toHaveCount(1);
  await page.goto("/resources?type=service-endpoints");
  await expect(page.locator(".sync-catalog")).toContainText("List users");
  await expect(page.locator(".sync-catalog")).toContainText(
    "Orion Identity API",
  );
});
