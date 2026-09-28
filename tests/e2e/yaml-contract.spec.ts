import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
for (const target of ["app", "html"]) {
  const base =
    target === "app"
      ? ""
      : pathToFileURL(path.resolve("docs/demo/approved.html")).href + "#";
  test(`${target}: domain owns Actions; endpoint and policy link to same detail`, async ({
    page,
  }) => {
    await page.goto(base + "/domains/employee");
    await expect(
      page.getByRole("tab", { name: "Action", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page
      .getByRole("link", { name: "담당 지역 직원 조회", exact: true })
      .click();
    await expect(
      page
        .getByRole("heading", { name: "담당 지역 직원 조회", exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText("subject.email", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: /업무 Action/ })
      .selectOption("action/employee/read-regional-contacts");
    await expect(page.getByText("원문 반환", { exact: true })).toHaveCount(2);
    await page
      .getByRole("button", { name: "엔드포인트 명세", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "endpoint/employee-api/search",
    );
  });
  test(`${target}: sync is reviewed, applied and retained across linked pages`, async ({
    page,
  }) => {
    await page.goto(base + "/definition-sync");
    await page.getByRole("button", { name: /동기화 검토/ }).click();
    await page
      .getByRole("button", { name: "변경사항 검토", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "동기화 적용", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("dialog")).toContainText("SEOUL, GYEONGGI");
    await expect(page.getByRole("dialog")).toContainText("SEOUL, BUSAN");
    await page
      .getByRole("checkbox", {
        name: "변경사항과 조회 범위 영향을 확인했습니다.",
      })
      .check();
    await page
      .getByRole("button", { name: "동기화 적용", exact: true })
      .click();
    await expect(
      page.getByText("DB 적용 완료 · Gateway 반영 확인 대기", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "업무 도메인", exact: true })
      .click();
    await page.getByRole("link", { name: "직원 관리", exact: true }).click();
    await page.getByRole("tab", { name: "조회 범위", exact: true }).click();
    await page.getByRole("link", { name: "영업 지역", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "SEOUL, BUSAN", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Synced · DB v8/)).toBeVisible();
  });
}
test("new domain navigation is accessible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/domains/employee");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
