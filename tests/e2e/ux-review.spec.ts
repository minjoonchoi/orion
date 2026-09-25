import { test, expect } from "@playwright/test";

test("list query survives detail navigation and reload; mobile menu reveals content", async ({
  page,
}) => {
  await page.goto("/users");
  await page.getByLabel("사용자 목록 검색").fill("김가람");
  await page.getByRole("link", { name: "김가람", exact: true }).click();
  await expect(page).toHaveURL(/users\/usr-001$/);
  await page.goBack();
  await expect(page.getByLabel("사용자 목록 검색")).toHaveValue("김가람");
  await page.reload();
  await expect(page.getByLabel("사용자 목록 검색")).toHaveValue("김가람");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator("main").evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(240);
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "조직", exact: true })
    .click();
  await expect(page).toHaveURL(/organizations$/);
  await expect(page.getByRole("button", { name: "메뉴 열기" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("rollback requires review and records confirmed restoration", async ({
  page,
}) => {
  await page.goto("/resources");
  await page.getByRole("button", { name: /Sync · 영향도 검토/ }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "최종 Sync 적용" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator("nav a[href='/resource-sync/history']"),
  ).toHaveCount(0);
  await page.goto("/resources?type=services&history=services:svc-orion");
  await page
    .locator(".sync-history-entry")
    .filter({ hasText: "revision 0" })
    .locator("summary")
    .click();
  await page.getByRole("button", { name: "이 revision으로 롤백" }).click();
  await expect(
    page.getByRole("button", { name: "롤백 적용", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "돌아가기", exact: true }).click();
  await expect(page.locator(".sync-history-entry")).toHaveCount(2);
  await page
    .locator(".sync-history-entry")
    .filter({ hasText: "revision 0" })
    .locator("summary")
    .click();
  await page.getByRole("button", { name: "이 revision으로 롤백" }).click();
  await page
    .getByRole("checkbox", {
      name: "복원할 revision과 적용 범위를 확인했습니다.",
    })
    .check();
  await page.getByRole("button", { name: "롤백 적용", exact: true }).click();
  await expect(page.locator(".sync-history-entry")).toHaveCount(3);
  await expect(page.locator(".sync-history-entry").first()).toContainText(
    "revision 2",
  );
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page).toHaveURL(/type=services/);
  await page.goto("/workspaces/ws-platform");
  await expect(
    page.getByRole("heading", { name: "Platform Operations", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "동기화 이력", exact: true }).click();
  await expect(page.locator(".sync-history-entry")).toHaveCount(2);
  await expect(page.getByRole("dialog")).not.toContainText("revision 2");
});
