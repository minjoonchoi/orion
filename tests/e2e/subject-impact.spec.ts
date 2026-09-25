import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("resource impact starts with subjects and preserves every reason including robot grants", async ({
  page,
}) => {
  await page.goto("/services/svc-orion");
  await page.getByRole("button", { name: "영향도 보기", exact: true }).click();
  const impact = page.getByRole("region", {
    name: "영향받는 대상",
    exact: true,
  });
  await impact.getByLabel("영향 대상·경로 검색").fill("김가람");
  const user = impact.locator(".subject-row");
  await expect(user).toHaveCount(1);
  await user.locator("summary").first().click();
  await expect(
    user.locator(".subject-path-meta").filter({ hasText: "직접 연결" }),
  ).toHaveCount(1);
  await expect(
    user.locator(".subject-path-meta").filter({ hasText: "조직 경유" }),
  ).toHaveCount(0);
  await expect(user.locator(".subject-path-chain").first()).toContainText(
    "플랫폼 조회",
  );
  await impact.getByLabel("영향 대상·경로 검색").clear();
  await impact.getByRole("button", { name: "조직 2", exact: true }).click();
  const org = impact
    .locator(".subject-row")
    .filter({ hasText: "org-platform" });
  await org.locator("summary").first().click();
  await expect(org.locator(".subject-members")).toHaveCount(0);
  await expect(
    org.getByRole("link", { name: "김가람", exact: true }),
  ).toHaveCount(0);
  await impact
    .getByRole("button", { name: "서비스 어카운트 1", exact: true })
    .click();
  const robot = impact.locator(".subject-row");
  await expect(robot).toContainText("platform-ci");
  await expect(impact).not.toContainText("directory-sync");
  await robot.locator("summary").first().click();
  await expect(robot.locator(".subject-path-chain")).toContainText(
    "플랫폼 관리자",
  );
  await expect(robot.locator(".subject-path-chain")).toContainText(
    "플랫폼 조회",
  );
  await expect(
    robot.getByRole("link", { name: /대상 상세 보기/ }),
  ).toHaveAttribute("href", "/service-accounts/sa-platform-ci");
  await robot.getByRole("link", { name: /대상 상세 보기/ }).click();
  await expect(
    page.getByRole("heading", { name: "platform-ci", exact: true }),
  ).toBeVisible();
});

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
    .filter({ hasText: "플랫폼 조회" })
    .getByRole("checkbox")
    .first()
    .uncheck();
  await dialog
    .getByRole("button", { name: "변경사항 검토", exact: true })
    .click();
  const impact = dialog.getByRole("region", {
    name: "영향받는 대상",
    exact: true,
  });
  await impact
    .getByRole("button", { name: "서비스 어카운트 1", exact: true })
    .click();
  const robot = impact.locator(".subject-row");
  await robot.locator("summary").first().click();
  await expect(robot).toContainText("해제되는 경로");
  await expect(robot).toContainText("플랫폼 조회");
  await expect(robot).not.toContainText("구성원 조회");
  await dialog.getByRole("button", { name: "수정으로 돌아가기" }).click();
});

test("English mobile subject paths are accessible and search keeps the policy reason", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "orion-locale", value: "en", domain: "127.0.0.1", path: "/" },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/services/svc-orion");
  await page.getByRole("button", { name: "View impact", exact: true }).click();
  const impact = page.getByRole("region", {
    name: "Affected subjects",
    exact: true,
  });
  await impact
    .getByRole("button", { name: "Service accounts 1", exact: true })
    .click();
  await impact.getByLabel("Search subjects and paths").fill("policy-platform");
  await impact.locator(".subject-row > summary").click();
  await expect(impact.locator(".subject-path-chain")).toContainText(
    "플랫폼 조회",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
