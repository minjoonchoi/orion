import { test, expect } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Both surfaces execute the same user interactions; SPA links preserve the UI adapter.
for (const surface of ["app", "html"] as const) {
  test(`${surface}: request review, no implicit grant, cancellation and surface persistence`, async ({
    page,
  }) => {
    await page.goto(
      surface === "app"
        ? "/my-access"
        : pathToFileURL(path.resolve("docs/demo/approved.html")).href +
            "#/my-access",
    );
    await expect(
      page.getByRole("heading", { name: "권한 목록", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".access-toolbar a")).toHaveCount(0);
    await page
      .locator("main")
      .getByRole("link", { name: "권한 신청 →", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "신청 역할", exact: true })
      .selectOption("role-security");
    await page
      .getByRole("textbox", { name: "신청 사유", exact: true })
      .fill("보안 검토 담당");
    await page
      .getByRole("button", { name: "신청 내용 검토", exact: true })
      .click();
    await page.getByRole("button", { name: "신청 제출", exact: true }).click();
    await expect(page.locator("main")).toContainText("결재 진행");
    await page.getByRole("tab", { name: "보유 권한", exact: true }).click();
    await expect(
      page.getByRole("table", { name: "가능한 업무", exact: true }),
    ).not.toContainText("보안 검토");
    await page.getByRole("tab", { name: /신청 내역/ }).click();
    await page.getByRole("button", { name: "신청 취소", exact: true }).click();
    await page.getByRole("button", { name: "취소 확정", exact: true }).click();
    await expect(page.locator("main")).toContainText("신청 취소");
    await page.reload();
    await expect(page.locator("main")).toContainText(
      surface === "app" ? "신청 취소" : "아직 신청한 권한이 없습니다",
    );
  });
  test(`${surface}: impact compares field exposure while preserving relationship paths`, async ({
    page,
  }) => {
    await page.goto(
      surface === "app"
        ? "/policies/policy-platform"
        : pathToFileURL(path.resolve("docs/demo/approved.html")).href +
            "#/policies/policy-platform",
    );
    await page.getByRole("button", { name: "동기화", exact: true }).click();
    await page
      .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
      .click();
    await page.getByRole("tab", { name: "영향도", exact: true }).click();
    await page.getByText("데이터 범위 변경", { exact: true }).first().click();
    const row = page
      .getByRole("row")
      .filter({ hasText: "김가람" })
      .filter({ hasText: "인사 업무 조회" });
    await expect(row).toContainText("phone: 미포함");
    await expect(row).toContainText("phone: 마스킹");
    await expect(page.locator(".def-subject").first()).toContainText(
      "플랫폼 관리자",
    );
    await expect(
      page.getByRole("button", { name: "동기화 적용", exact: true }),
    ).toBeDisabled();
  });
}
