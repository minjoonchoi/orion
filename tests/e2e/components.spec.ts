import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/components");
});

test("filter, sort, pagination and selection compose without hidden selections", async ({
  page,
}) => {
  const table = page.getByRole("table", { name: "예제 사용자 목록" });
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await page
    .getByRole("checkbox", { name: "김가람 선택", exact: true })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "현재 페이지 전체 선택" }),
  ).toHaveJSProperty("indeterminate", true);
  await page.getByRole("checkbox", { name: "현재 페이지 전체 선택" }).check();
  await expect(page.getByText("5명 선택됨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page.getByText("2 / 3 페이지")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "현재 페이지 전체 선택" }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "서도윤 선택", exact: true })
    .check();
  await expect(page.getByText("6명 선택됨", { exact: true })).toBeVisible();
  await page
    .getByLabel("사용자 검색", { exact: true })
    .fill("  MEMBER1@EXAMPLE.TEST  ");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("0명 선택됨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  const header = page.getByRole("columnheader", { name: /이름/ });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await header.getByRole("button").click();
  await expect(table.locator("tbody tr").first()).toContainText("한지우");
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "none");
  await page.getByLabel("상태 필터").selectOption("inactive");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await page.getByLabel("사용자 검색").fill("없는사용자");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 없습니다" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
});

test("dialog validation, keyboard focus trap, Escape and focus restoration", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "사용자 추가",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "예제 사용자 추가" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("이름", { exact: false }).fill("새사용자");
  await dialog
    .getByLabel("이메일", { exact: false })
    .fill("member1@example.test");
  await dialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(dialog.getByText("이미 등록된 이메일입니다.")).toBeVisible();
  await expect(dialog.getByLabel("이메일", { exact: false })).toBeFocused();
  await dialog.getByLabel("이메일", { exact: false }).fill("new@example.test");
  await dialog.getByRole("button", { name: "추가", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("table").getByText("새사용자", { exact: true }),
  ).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: "추가", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "닫기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("destructive confirmation defaults to cancel and removes only selected rows", async ({
  page,
}) => {
  await page
    .getByRole("checkbox", { name: "김가람 선택", exact: true })
    .check();
  await page.getByRole("button", { name: "선택 삭제", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("button", { name: "취소", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "선택 삭제", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "선택 삭제", exact: true }).click();
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(
    page.getByRole("table").getByText("김가람", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("table").getByText("김다온", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("사용자 검색")).toBeFocused();
  await expect(page.getByText("총 11개", { exact: true })).toBeVisible();
});

test("row action menu, tabs and drawer support keyboard navigation", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "김가람 작업" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("row").filter({ hasText: "김가람" }),
  ).toContainText("활성");
  await expect(trigger).toBeFocused();
  await page.getByRole("tab", { name: "목록과 작업" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "입력과 피드백" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "사용 안내", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "컴포넌트 사용 안내" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "사용 안내", exact: true }),
  ).toBeFocused();
});

test("permission matrix supports mixed state, allowed actions and read-only mode", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "권한 매트릭스", exact: true }).click();
  const all = page.getByRole("checkbox", {
    name: "사용자 전체 선택",
    exact: true,
  });
  await expect(all).toHaveJSProperty("indeterminate", true);
  await all.check();
  await expect(
    page.getByText("3개 권한 선택됨", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "조회 전체 선택", exact: true })
    .check();
  await expect(
    page.getByText("5개 권한 선택됨", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "감사 로그 수정", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "읽기 전용" }).check();
  await expect(all).toBeDisabled();
  await expect(page.getByRole("button", { name: "선택 확인" })).toBeDisabled();
  await page.getByRole("tab", { name: "목록과 작업" }).click();
  await page.getByRole("tab", { name: "권한 매트릭스", exact: true }).click();
  await expect(
    page.getByText("5개 권한 선택됨", { exact: true }),
  ).toBeVisible();
});

test("components have no automated WCAG A/AA violations", async ({ page }) => {
  for (const tab of ["목록과 작업", "입력과 피드백", "권한 매트릭스"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  await page.getByRole("tab", { name: "목록과 작업" }).click();
  await page.getByRole("button", { name: "사용자 추가", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("mobile layout contains overflow within the table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "백오피스 컴포넌트" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const region = page.getByRole("region", {
    name: "예제 사용자 목록",
    exact: true,
  });
  expect(
    await region.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "사용자 추가", exact: true }).click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});
