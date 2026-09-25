import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("GitOps diff, explicit review, apply and catalog projection", async ({
  page,
}) => {
  await page.goto("/resource-sync");
  await expect(page.getByText("revision 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "변경 관리" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("services");
  await expect(page.locator(".sync-catalog")).toContainText("Out of sync");
  await page
    .getByRole("button", { name: /diff 확인/ })
    .first()
    .click();
  await expect(page.locator("#resource-diff")).toContainText(
    "Orion Identity API",
  );
  await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await page.getByRole("button", { name: /전체 변경 동기화/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "동기화 적용" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("heading", { name: "변경 전후", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("리소스 8");
  await dialog.locator(".sync-confirm input").check();
  await dialog.getByRole("button", { name: "동기화 적용" }).click();
  await expect(page.getByRole("status")).toContainText("succeeded");
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /전체 변경 동기화/ }),
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
  await page.getByRole("button", { name: /Sync all changes/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
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
  await page.getByRole("button", { name: /전체 변경 동기화/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  const other = await context.newPage();
  await other.goto("/users/usr-014");
  await other.getByRole("button", { name: "역할 부여", exact: true }).click();
  const edit = other.getByRole("dialog");
  await edit
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .check();
  await edit
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await edit.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(edit.getByRole("status")).toContainText(
    "변경사항을 적용했습니다",
  );
  const review = page.getByRole("dialog");
  await review.locator(".sync-confirm input").check();
  await review
    .getByRole("button", { name: "동기화 적용", exact: true })
    .click();
  await expect(review.getByRole("alert")).toContainText(
    "버전이 변경되었습니다",
  );
  await review.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /전체 변경 동기화/ }),
  ).toBeEnabled();
  await other.close();
});

test("unified catalog filters, detail diff links and persistent session history", async ({
  page,
}) => {
  await page.goto("/resources");
  await expect(
    page.getByRole("heading", { name: "변경 관리", exact: true }),
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
  await page.getByRole("button", { name: "목록으로 돌아가기" }).click();
  await expect(
    page.getByRole("button", {
      name: "전체 변경 동기화 · 8",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "전체 변경 동기화 · 8",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(dialog.locator(".sync-review-list > details")).toHaveCount(8);
  await dialog.locator(".sync-confirm input").check();
  await dialog.getByRole("button", { name: "동기화 적용" }).click();
  await expect(page.getByText("revision 1", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "동기화 상태", exact: true })
    .selectOption("all");
  await page
    .getByRole("link", {
      name: "Orion Identity API · 동기화 이력",
      exact: true,
    })
    .click();
  await expect(page.locator(".sync-history-entry")).toHaveCount(2);
  await expect(page.getByRole("dialog")).toContainText("revision 1");
  await page.reload();
  await expect(page.locator(".sync-history-entry")).toHaveCount(2);
  await page.goto("/resources?type=service-endpoints");
  await expect(page.locator(".sync-catalog")).toContainText("List users");
  await expect(page.locator(".sync-catalog")).toContainText(
    "Orion Identity API",
  );
});
test("resource history empty state, legacy redirect and English mobile access", async ({
  page,
  context,
}) => {
  await page.goto("/resource-sync/history");
  await expect(page).toHaveURL(/\/resources$/);
  await page.goto("/resources?history=services:svc-orion");
  await expect(page.getByRole("dialog")).toContainText(
    "이 리소스의 동기화 이력이 없습니다.",
  );
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText(
    "This resource has no sync history.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("deleted resource history remains reachable from the catalog", async ({
  page,
}) => {
  await page.goto("/resources?type=workspaces");
  await page.getByRole("button", { name: /전체 변경 동기화/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await page.getByRole("dialog").locator(".sync-confirm input").check();
  await page.getByRole("button", { name: "동기화 적용" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: "ws-empty" });
  await expect(row).toContainText("Synced · 삭제됨");
  await row.getByRole("link", { name: /동기화 이력/ }).click();
  await expect(page.locator(".sync-history-entry")).toHaveCount(2);
  await expect(page.locator(".sync-history-entry").first()).toContainText(
    "삭제",
  );
  await expect(page.getByRole("dialog")).not.toContainText(
    "Orion Identity API",
  );
});
