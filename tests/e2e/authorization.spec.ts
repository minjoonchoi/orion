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
  await dialog
    .getByRole("button", { name: "변경사항 검토", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "변경사항 확인" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(
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
  await dialog
    .locator(".access-card")
    .filter({ hasText: "플랫폼 관리자" })
    .getByText("연결 정책과 리소스", { exact: false })
    .click();
  const summary = dialog.getByRole("complementary", { name: "부여 내용 요약" });
  await expect(summary).toContainText("부여받는 대상 · 1");
  await summary
    .locator(".explorer-column")
    .getByRole("button", { name: /플랫폼 관리자/ })
    .click();
  await summary
    .locator(".explorer-column")
    .getByRole("button", { name: /플랫폼 조회/ })
    .click();
  await summary
    .locator(".explorer-column")
    .getByRole("button", { name: /서비스/, exact: false })
    .filter({ hasText: /^서비스›/ })
    .click();
  await expect(summary.locator(".explorer-column")).toContainText([
    "플랫폼 관리자",
    "플랫폼 조회",
    "서비스",
    "Orion",
  ]);
  await dialog.getByLabel("이름 또는 식별자로 검색").fill("no-match");
  await expect(summary).toContainText("플랫폼 관리자");
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
  await dialog.getByRole("button", { name: "변경사항 검토" }).click();
  await expect(dialog.getByRole("alert")).toContainText("현재 이후");
  await card.getByLabel("만료 시점", { exact: true }).fill("2030-12-31T10:00");
  await save(page);
  await dialog.getByRole("button", { name: "정책 부여와 만료" }).click();
  await expect(dialog.getByLabel("만료 시점", { exact: true })).toHaveValue(
    "2030-12-31T10:00",
  );
});
test("one deny policy can link resources of all four types and expose indirect impact", async ({
  page,
}) => {
  let dialog = await open(
    page,
    "/policies/policy-platform",
    "리소스 연결과 정책 효과",
  );
  await dialog.getByRole("radio", { name: "거부", exact: true }).check();
  await dialog.getByLabel("리소스 유형", { exact: true }).selectOption("pages");
  await dialog.getByRole("checkbox", { name: /사용자 관리/ }).check();
  await dialog.getByRole("checkbox", { name: /조직 관리/ }).check();
  await save(page);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  dialog = await open(page, "/pages/page-users", "리소스 수정과 영향 범위");
  const explorer = dialog.locator(".access-impact .access-explorer");
  await explorer
    .getByRole("button", { name: "목록 보기", exact: true })
    .click();
  await explorer
    .getByRole("button", { name: "플랫폼 조회 하위 항목", exact: true })
    .click();
  await explorer
    .getByRole("button", { name: "플랫폼 관리자 하위 항목", exact: true })
    .click();
  await expect(explorer).toContainText("플랫폼 조회");
  await expect(explorer).toContainText("플랫폼 관리자");
  await expect(explorer).toContainText("플랫폼개발팀");
  await expect(explorer).toContainText("김가람");
  await expect(explorer).toContainText("거부");
  await dialog.getByLabel("관계 검색").fill("no-matching-path");
  await expect(explorer).toContainText("연결된 항목이 없습니다");
  await dialog.getByLabel("관계 검색").fill("");
  await dialog.getByLabel("이름", { exact: true }).fill("사용자 관리 수정");
  await save(page);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "사용자 관리 수정", exact: true }),
  ).toBeVisible();
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
test("English impact dialog supports keyboard, mobile and accessible form controls", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  const dialog = await open(
    page,
    "/services/svc-orion",
    "Edit resource and explore impact",
  );
  await expect(
    dialog.getByRole("heading", { name: "Explore impact", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit resource and explore impact" }),
  ).toBeFocused();
});

test("explorer keeps column path across views and assignment summary follows draft selection", async ({
  page,
}) => {
  let dialog = await open(
    page,
    "/services/svc-orion",
    "리소스 수정과 영향 범위",
  );
  const explorer = dialog.locator(".access-impact .access-explorer");
  await explorer
    .locator(".explorer-column")
    .getByRole("button", { name: /플랫폼 조회/ })
    .click();
  await explorer
    .locator(".explorer-column")
    .getByRole("button", { name: /플랫폼 관리자/ })
    .click();
  await explorer
    .getByRole("button", { name: "목록 보기", exact: true })
    .click();
  await expect(explorer.locator(".explorer-row")).toHaveCount(2);
  await explorer
    .getByRole("button", { name: "계층 보기", exact: true })
    .click();
  await expect(explorer.locator(".explorer-column")).toHaveCount(3);
  await explorer.getByRole("button", { name: "전체", exact: true }).click();
  await expect(explorer.locator(".explorer-column")).toHaveCount(1);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  dialog = await open(page, "/users/usr-014", "역할 부여");
  const summary = dialog.getByRole("complementary", { name: "부여 내용 요약" });
  await dialog
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .check();
  await expect(summary).toContainText("플랫폼 관리자");
  await dialog
    .getByRole("checkbox", { name: "플랫폼 관리자", exact: true })
    .uncheck();
  await expect(summary).not.toContainText("플랫폼 관리자");
  await expect(summary).toContainText("부여받는 대상 · 1");
});
