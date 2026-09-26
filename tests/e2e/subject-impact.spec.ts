import { test, expect } from "@playwright/test";
test("policy sync impact shows direct service account and its role-policy-action path", async ({
  page,
}) => {
  await page.goto("/policies/policy-platform");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await dialog.getByRole("tab", { name: "영향도", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "영향도 대상", exact: true })
    .selectOption("policies:policy-platform");
  await dialog
    .getByRole("textbox", { name: "영향 대상 검색", exact: true })
    .fill("platform-ci");
  const robot = dialog.locator(".def-subject");
  await expect(robot).toHaveCount(1);
  await robot.locator("summary").click();
  await expect(robot).toContainText("플랫폼 관리자");
  await expect(robot).toContainText("인사 사용자 상세 조회");
  await expect(robot).toContainText("identity / read-hr");
  await expect(robot).not.toContainText("조직 경유");
  await expect(robot).not.toContainText("직원 기본 조회");
  await robot.locator("summary").click();
  await expect(robot.locator(".def-depth")).toBeHidden();
});
