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
  await expect(dialog).toContainText("플랫폼 멤버십은 유지합니다.");
  await dialog.getByRole("button", { name: "이전", exact: true }).click();
  await expect(
    dialog.getByRole("checkbox", { name: "송유진", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "변경 내용 검토" }).click();
  await applyRoleUser(page);
  const table = page.getByRole("table", { name: "역할 사용자", exact: true });
  await expect(table).toContainText("member14@example.test");
  await expect(
    table.getByRole("row").filter({ hasText: "송유진" }),
  ).toContainText("미가입");
  await selectRoleUser(
    page,
    "role-platform",
    "member14@example.test",
    "remove",
  );
  await applyRoleUser(page);
  await expect(table).not.toContainText("member14@example.test");
  await expect(table).toContainText("member1@example.test");
});
test("scoped organization and policy tabs expose explicit editors", async ({
  page,
}) => {
  for (const tab of ["organizations", "policies"]) {
    await page.goto(`/roles/role-platform?tab=${tab}`);
    await expect(page.getByRole("tabpanel")).toContainText(
      tab === "policies" ? "인사 사용자 상세 조회" : "플랫폼개발팀",
    );
    await expect(
      page.getByRole("button", {
        name: tab === "policies" ? "정책 및 만료 관리" : "조직 부여 관리",
        exact: true,
      }),
    ).toBeVisible();
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
  await context.addCookies(
    ["orion-platform-demo", "orion-demo-access"].map((name) => ({
      name,
      value: "logout-test",
      domain: "127.0.0.1",
      path: "/",
    })),
  );
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
  await expect(dialog).toContainText(
    "다른 역할의 부여와 플랫폼 멤버십은 유지합니다.",
  );
  await applyRoleUser(page);
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "사용자", exact: true })
    .click();
  await page.getByRole("link", { name: "김가람", exact: true }).click();
  await page.getByRole("tab", { name: /^역할 \(/ }).click();
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
