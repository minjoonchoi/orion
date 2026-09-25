import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function open(page: Page, path: string, label: string) {
  await page.goto(path);
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("form")).toBeVisible();
  return dialog;
}
async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  if (
    await dialog
      .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
      .count()
  )
    await dialog
      .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
      .click();
  await expect(
    dialog.getByRole("heading", { name: "변경사항 확인" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "변경사항을 적용했습니다",
  );
}
test("assign roles with policy/resource preview and reflect changes in user and organization details", async ({
  page,
}) => {
  const dialog = await open(page, "/users/usr-014", "역할 부여");
  await dialog
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .check();
  await expect(dialog.locator(".assignment-summary")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  const summary = dialog.getByRole("complementary", { name: "부여 내용 요약" });
  await expect(summary).toContainText("부여받는 대상 · 1");
  await summary.getByText("변경 후 정책·리소스 확인", { exact: true }).click();
  await expect(summary).toContainText("Orion");
  await dialog
    .getByRole("button", { name: "수정으로 돌아가기", exact: true })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: "플랫폼 관리자", exact: true }),
  ).toBeChecked();
  await save(page);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("tab", { name: "역할 (1)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "역할 목록", exact: true }),
  ).toContainText("플랫폼 관리자");
  await open(page, "/organizations/org-archive", "역할 부여");
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: "보안 검토자", exact: true })
    .check();
  await save(page);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page.getByRole("tab", { name: "역할 (1)", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "역할 목록", exact: true }),
  ).toContainText("보안 검토자");
});
test("policy binding expiry validates past dates and persists on the role", async ({
  page,
}) => {
  const dialog = await open(page, "/roles/role-unassigned", "역할 부여 관리");
  await dialog
    .getByRole("button", { name: "정책 부여와 만료", exact: true })
    .click();
  const card = dialog
    .locator(".access-card")
    .filter({ hasText: "플랫폼 조회" });
  await card.getByRole("checkbox", { name: /플랫폼 조회/ }).check();
  await card.getByRole("checkbox", { name: "무기한", exact: true }).uncheck();
  await card.getByLabel("만료 시점", { exact: true }).fill("2020-01-01T10:00");
  await dialog.getByRole("button", { name: "변경사항 및 영향도 검토" }).click();
  await expect(dialog.getByRole("alert")).toContainText("현재 이후");
  await card.getByLabel("만료 시점", { exact: true }).fill("2030-12-31T10:00");
  await save(page);
  await dialog.getByRole("button", { name: "완료", exact: true }).click();
  await page
    .getByRole("button", { name: "역할 부여 관리", exact: true })
    .click();
  await dialog.getByRole("button", { name: "정책 부여와 만료" }).click();
  await expect(dialog.getByLabel("만료 시점", { exact: true })).toHaveValue(
    "2030-12-31T10:00",
  );
});
test("policy definitions are reviewed through GitOps", async ({ page }) => {
  await page.goto("/policies/policy-platform");
  await expect(
    page.getByRole("button", { name: "리소스 연결과 정책 효과" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "정책 변경 검토" }).click();
  await expect(page).toHaveURL(/policies\/sync$/);
  await page.getByRole("button", { name: /전체 변경 동기화/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("정책 3");
  await expect(
    page.getByRole("button", { name: "동기화 적용", exact: true }),
  ).toBeDisabled();
});
test("logout clears demo session and keeps locale; common denied screen is accessible", async ({
  page,
  context,
}) => {
  await open(page, "/users/usr-014", "역할 부여");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
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
});
test("English resource editing is routed to GitOps", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/services/svc-orion");
  await expect(
    page.getByText(
      "Resource definitions are managed in Git. Edit YAML and sync to update or delete.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit resource and explore impact" }),
  ).toHaveCount(0);
});

test("list explorer exposes removal and supports collapse", async ({
  page,
}) => {
  const dialog = await open(page, "/roles/role-platform", "역할 부여 관리");
  await dialog
    .getByRole("button", { name: "정책 부여와 만료", exact: true })
    .click();
  const summary = dialog.getByRole("complementary", { name: "부여 내용 요약" });
  await expect(summary).toHaveCount(0);
  await dialog
    .locator(".access-card")
    .filter({ hasText: "플랫폼 조회" })
    .getByRole("checkbox")
    .first()
    .uncheck();
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await summary.getByText("변경 후 정책·리소스 확인", { exact: true }).click();
  await expect(summary.locator(".delta-remove")).toContainText("플랫폼 조회");
  await summary.getByRole("button", { name: "모두 접기", exact: true }).click();
  await expect(summary.locator(".explorer-row:visible")).toHaveCount(1);
  await summary
    .getByRole("button", { name: "모두 펼치기", exact: true })
    .click();
  await expect(summary.locator(".explorer-list:visible")).toContainText(
    "구성원 조회",
  );
});
