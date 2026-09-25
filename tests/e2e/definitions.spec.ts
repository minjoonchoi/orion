import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("domain actions navigate to scoped endpoint and policy response rules", async ({
  page,
}) => {
  await page.goto("/domains/identity");
  await expect(
    page.getByRole("heading", { name: "임직원 관리", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /인사 업무 조회/ })
    .first()
    .click();
  await expect(page).toHaveURL(/actions\/identity~read-hr/);
  await expect(
    page.getByRole("heading", { name: "정책별 응답 범위" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "연결 관계", exact: true }).click();
  await page.getByRole("link", { name: /사용자 기본 정보 조회/ }).click();
  await expect(page).toHaveURL(/service-endpoints\/identity-api~detail/);
  await page.getByRole("tab", { name: "연결 관계", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "동일 엔드포인트의 Action 비교" }),
  ).toBeVisible();
  await expect(page.locator("[role=tabpanel]:visible")).toContainText(
    "read-summary",
  );
  await expect(page.locator("[role=tabpanel]:visible")).toContainText(
    "read-hr",
  );
});
test("policy preview includes dependencies; same two views and consent, scoped apply and rollback", async ({
  page,
}) => {
  await page.goto("/policies/policy-platform");
  await expect(
    page.getByRole("row").filter({ hasText: "/phone" }),
  ).toContainText("미포함");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("service-endpoints:identity-api/detail");
  await expect(dialog).not.toContainText(
    "service-endpoints:directory-api/detail",
  );
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "동기화 적용" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("tab", { name: "YAML diff" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await dialog.getByRole("tab", { name: "영향도", exact: true }).click();
  await expect(dialog).toContainText("반환 필드 추가: phone");
  await dialog
    .getByRole("combobox", { name: "영향도 대상", exact: true })
    .selectOption("policies:policy-platform");
  await expect(dialog.locator(".def-subject")).toHaveCount(3);
  await dialog.locator(".def-subject summary").first().click();
  await expect(dialog.locator(".def-depth").first()).toContainText(
    "인사 업무 조회",
  );
  await dialog
    .getByRole("checkbox", { name: "변경사항과 영향 범위를 확인했습니다." })
    .check();
  await dialog.getByRole("button", { name: "동기화 적용" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "/phone" }),
  ).toContainText("keep-last");
  await page.getByRole("tab", { name: "동기화 이력", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이 버전으로 복원 검토" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "이 버전으로 복원 검토" })
    .last()
    .click();
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await dialog
    .getByRole("checkbox", { name: "변경사항과 영향 범위를 확인했습니다." })
    .check();
  await dialog.getByRole("button", { name: "동기화 적용" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("tab", { name: "상세 정보", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "/phone" }),
  ).toContainText("미포함");
  await page.goto("/service-endpoints/identity-api~detail");
  await expect(
    page.getByRole("heading", { name: "사용자 상세 조회", exact: true }),
  ).toBeVisible();
});
test("partial sync preserves other pending policy and selection across filtering", async ({
  page,
}) => {
  await page.goto("/resources?status=out-of-sync");
  await expect(page.locator(".def-table tbody tr")).toHaveCount(2);
  const row = page
    .getByRole("row")
    .filter({ hasText: "identity-api / detail" });
  await row.getByRole("checkbox").check();
  await page
    .getByRole("combobox", { name: "리소스 유형", exact: true })
    .selectOption("policies");
  await expect(page.locator(".def-selection")).toContainText("선택한 항목 1");
  await page.reload();
  await page.getByRole("button", { name: "선택 항목 동기화" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).not.toContainText("policies:policy-platform");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "동기화 적용" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".def-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".def-table")).toContainText("Out of sync");
});
test("same local endpoint ID is resolved using service parent", async ({
  page,
}) => {
  await page.goto("/service-endpoints/directory-api~detail");
  await expect(
    page.getByRole("heading", { name: "디렉터리 사용자 조회", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("[role=tabpanel]:visible .def-table").last(),
  ).not.toContainText("phone");
  await page.goto("/service-endpoints/identity-api~detail");
  await expect(
    page.locator("[role=tabpanel]:visible .def-table").last(),
  ).toContainText("phone");
});
test("subject evaluation calls server, masks fields, and no grant for unrelated action", async ({
  page,
}) => {
  await page.goto("/actions/identity~read-hr");
  await page.getByRole("tab", { name: "권한 평가", exact: true }).click();
  await page
    .getByRole("combobox", { name: "권한 평가 대상" })
    .selectOption("users:usr-001");
  await page.getByRole("button", { name: "권한 평가", exact: true }).click();
  const panel = page.locator("[role=tabpanel]:visible");
  await expect(
    panel.getByRole("row").filter({ hasText: "email" }),
  ).toContainText("마스킹");
  await expect(
    panel.getByRole("row").filter({ hasText: "phone" }),
  ).toContainText("미포함");
});
test("English mobile policy and sync review are accessible without page overflow", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/policies/policy-platform");
  await page.getByRole("button", { name: "Sync", exact: true }).click();
  await page
    .getByRole("button", { name: "Review changes & impact", exact: true })
    .click();
  await page.getByRole("tab", { name: "Impact", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
