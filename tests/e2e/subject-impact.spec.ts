import { test, expect } from "@playwright/test";
test("policy removal review shows affected service accounts and removed role-policy paths", async ({
  page,
}) => {
  await page.goto("/roles/role-platform");
  await page
    .getByRole("button", { name: "역할 부여 관리", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "정책 부여와 만료", exact: true })
    .click();
  await dialog
    .locator(".access-card")
    .filter({ hasText: "인사 사용자 상세 조회" })
    .getByRole("checkbox")
    .first()
    .uncheck();
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  const impact = dialog.getByRole("region", {
    name: "영향받는 대상",
    exact: true,
  });
  await impact
    .getByRole("combobox", { name: "영향 대상 유형" })
    .selectOption("service-accounts");
  const robot = impact.locator(".subject-row");
  await robot.locator("summary").first().click();
  await expect(robot).toContainText("해제되는 경로");
  await expect(robot).toContainText("인사 사용자 상세 조회");
  await expect(robot).not.toContainText("구성원 조회");
  await dialog.getByRole("button", { name: "수정으로 돌아가기" }).click();
});
