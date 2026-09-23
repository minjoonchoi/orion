import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("inverse relationships open the correct detail pages", async ({
  page,
}) => {
  const cases = [
    [
      "/roles/role-platform",
      "연결 서비스 어카운트",
      "platform-ci",
      "/service-accounts/sa-platform-ci",
    ],
    [
      "/api-keys/key-directory",
      "연결 서비스 어카운트",
      "directory-sync",
      "/service-accounts/sa-directory-sync",
    ],
    [
      "/policies/policy-platform",
      "정책이 연결된 역할",
      "플랫폼 관리자",
      "/roles/role-platform",
    ],
    [
      "/services/svc-orion",
      "연결 정책",
      "플랫폼 조회",
      "/policies/policy-platform",
    ],
    [
      "/services/svc-orion",
      "관리 조직",
      "플랫폼개발팀",
      "/organizations/org-platform",
    ],
    [
      "/service-endpoints/ep-roles",
      "연결 정책",
      "플랫폼 조회",
      "/policies/policy-platform",
    ],
    [
      "/workspaces/ws-platform",
      "연결 정책",
      "보안 검토",
      "/policies/policy-security",
    ],
    [
      "/organizations/org-platform",
      "조직 API 키",
      "디렉터리 동기화",
      "/api-keys/key-directory",
    ],
    [
      "/users/usr-001",
      "소유 API 키",
      "디렉터리 동기화",
      "/api-keys/key-directory",
    ],
    [
      "/users/usr-001",
      "요청한 결재",
      "디렉터리 동기화 · API 키 발급",
      "/approvals/approval-001",
    ],
    [
      "/users/usr-006",
      "처리한 결재",
      "플랫폼 CI · API 키 발급",
      "/approvals/approval-007",
    ],
    [
      "/approval-templates/template-key-issue-v1",
      "템플릿을 사용한 결재",
      "디렉터리 동기화 · API 키 발급",
      "/approvals/approval-001",
    ],
  ];
  for (const [source, title, label, target] of cases) {
    await page.goto(source);
    const region = page.getByRole("region", {
      name: `${title} 조회`,
      exact: true,
    });
    await region.getByRole("searchbox").fill(label);
    await region.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(target + "$"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
test("relationship counts open the corresponding tab", async ({ page }) => {
  const cases = [
    ["/users", "김가람", "2개", "/users/usr-001?tab=roles"],
    [
      "/organizations",
      "플랫폼개발팀",
      "7명",
      "/organizations/org-platform?tab=members",
    ],
    ["/roles", "플랫폼 관리자", "1명", "/roles/role-platform?tab=users"],
    [
      "/policies",
      "플랫폼 조회",
      "2개",
      "/policies/policy-platform?tab=endpoints",
    ],
    ["/services", "Orion", "2개", "/services/svc-orion?tab=endpoints"],
    ["/workspaces", "플랫폼 운영", "6개", "/workspaces/ws-platform?tab=pages"],
  ];
  for (const [source, name, count, target] of cases) {
    await page.goto(source);
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name, exact: true }) });
    await row.getByRole("link", { name: count, exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname + url.search === target);
    await expect(page.getByRole("tab", { selected: true })).not.toHaveText(
      "기본 정보",
    );
  }
  await page.goto("/service-accounts");
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "platform-ci", exact: true }),
  });
  await row.getByRole("link").filter({ hasText: "2개" }).last().click();
  await expect(page).toHaveURL(/sa-platform-ci\?tab=api-keys$/);
});
test("related lists support keyboard navigation, empty state and narrow screens", async ({
  page,
}) => {
  await page.goto("/api-keys/key-product");
  await expect(
    page
      .getByRole("region", { name: "연결 서비스 어카운트 조회" })
      .getByRole("heading", { name: "연결 서비스 어카운트 없음" }),
  ).toBeVisible();
  await page.goto("/roles/role-platform");
  const link = page
    .getByRole("region", { name: "연결 서비스 어카운트 조회" })
    .getByRole("link", { name: "platform-ci", exact: true });
  await link.focus();
  await link.press("Enter");
  await expect(page).toHaveURL(/service-accounts\/sa-platform-ci$/);
  await page.goBack();
  await expect(page).toHaveURL(/roles\/role-platform$/);
  for (const route of [
    "/users/usr-001",
    "/services/svc-orion",
    "/approval-templates/template-key-issue-v1",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("region", { name: "관련 항목", exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});
