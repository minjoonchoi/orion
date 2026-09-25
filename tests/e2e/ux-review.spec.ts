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
