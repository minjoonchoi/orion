import { test, expect } from "@playwright/test";
test("impact narrows to one selected definition and never expands organization members", async ({
  page,
}) => {
  await page.goto("/resources?status=out-of-sync");
  await page
    .getByRole("checkbox", { name: "현재 페이지 선택", exact: true })
    .check();
  await page.getByRole("button", { name: "영향도 검토", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "영향도 대상", exact: true })
    .selectOption("policies:policy-platform");
  await expect(dialog.locator(".def-subject")).toHaveCount(3);
  await dialog
    .getByRole("textbox", { name: "영향 대상 검색", exact: true })
    .fill("platform-ci");
  await expect(dialog.locator(".def-subject")).toHaveCount(1);
  await dialog.locator("summary").click();
  await expect(dialog.locator(".def-depth")).toContainText(
    "identity / read-hr",
  );
  await expect(dialog.locator(".def-depth")).not.toContainText("조직 경유");
});
