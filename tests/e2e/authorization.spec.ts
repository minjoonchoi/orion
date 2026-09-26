import { selectRoleUser, applyRoleUser } from "./role-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("role user review preserves membership and allows add/remove from role details", async ({
  page,
}) => {
  const dialog = await selectRoleUser(
    page,
    "role-platform",
    "member14@example.test",
  );
  await expect(dialog).toContainText("Orion");
  await expect(dialog).toContainText("플랫폼 관리자");
  await expect(
    dialog.getByRole("link", { name: "인사 사용자 상세 조회" }),
  ).toHaveAttribute("href", "/policies/policy-platform");
  await expect(dialog).toContainText("플랫폼 멤버십은 변경하지 않습니다.");
  await dialog.getByRole("button", { name: "이전", exact: true }).click();
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await dialog.getByRole("button", { name: "변경사항 및 영향도 검토" }).click();
  await applyRoleUser(page);
  await expect(
    page.getByRole("table", { name: "사용자 목록", exact: true }),
  ).toContainText("member14@example.test");
  await page.goto("/users/usr-014?tab=roles");
  await expect(
    page.getByRole("table", { name: "플랫폼 역할 목록", exact: true }),
  ).toContainText("플랫폼 관리자");
  await expect(
    page.getByRole("tab", { name: "플랫폼 (0)", exact: true }),
  ).toBeVisible();
  await selectRoleUser(
    page,
    "role-platform",
    "member14@example.test",
    "remove",
  );
  await applyRoleUser(page);
  await page.goto("/users/usr-014?tab=roles");
  await expect(
    page.getByRole("heading", { name: "항목이 없습니다" }),
  ).toBeVisible();
});
test("scoped organization and policy tabs are read-only until editors are integrated", async ({
  page,
}) => {
  // ROL-04/05, GAP-04: expiry/model tests remain in authorization/model.test.ts.
  for (const tab of ["organizations", "policies"]) {
    await page.goto(`/roles/role-platform?tab=${tab}`);
    await expect(page.getByRole("tabpanel")).toContainText(
      tab === "policies" ? "인사 사용자 상세 조회" : "플랫폼개발팀",
    );
    await expect(
      page.getByRole("button", { name: "역할 부여 관리", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "사용자 추가", exact: true }),
    ).toHaveCount(0);
  }
});
test("policy definitions are read-only and use common sync review", async ({
  page,
}) => {
  await page.goto("/policies/policy-platform");
  await expect(
    page.getByRole("button", { name: "리소스 지정과 정책 효과" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  await page
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "동기화 적용", exact: true }),
  ).toBeDisabled();
});
test("logout clears demo session and keeps locale; common denied screen is accessible", async ({
  page,
  context,
}) => {
  await selectRoleUser(page, "role-platform", "member14@example.test");
  await applyRoleUser(page);
  await page.goto("/policies/policy-platform");
  await expect(page.locator(".sync-status")).toHaveText("Out of sync");
  expect(
    (await context.cookies()).some((c) => c.name === "orion-platform-demo"),
  ).toBe(true);
  expect(
    (await context.cookies()).some((c) => c.name === "orion-demo-access"),
  ).toBe(true);
  await page.goto("/forbidden");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없습니다" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .locator("header")
    .getByRole("button", { name: "로그아웃", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await context.cookies()).some((c) => c.name === "orion-demo-access"),
  ).toBe(false);
  expect(
    (await context.cookies()).some((c) => c.name === "orion-platform-demo"),
  ).toBe(false);
});
test("English resource editing is read-only with YAML and sync", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/service-endpoints/identity-api~detail");
  await expect(
    page.getByRole("tab", { name: "YAML", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sync", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Edit resource and explore impact" }),
  ).toHaveCount(0);
});
test("role removal review keeps unrelated platform roles and memberships", async ({
  page,
}) => {
  const dialog = await selectRoleUser(
    page,
    "role-platform",
    "member1@example.test",
    "remove",
  );
  await expect(dialog).toContainText("다른 역할과 플랫폼 멤버십은 유지합니다.");
  await applyRoleUser(page);
  await page.goto("/users/usr-001?tab=roles");
  await expect(
    page.getByRole("tab", { name: "플랫폼 (2)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "항목이 없습니다" }),
  ).toBeVisible();
  await page.getByLabel("플랫폼 필터").selectOption("finance");
  await expect(
    page.getByRole("table", { name: "플랫폼 역할 목록", exact: true }),
  ).toContainText("정산 검토자");
});
