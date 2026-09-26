// Stable screen IDs. Add a state here whenever a screen, tab or modal is introduced.
export const screens = [
  ["HOME-01", "/"],
  ["AUTH-01", "/login"],
  ["COM-403", "/forbidden"],
  ["PLT-01", "/platforms"],
  ["PLT-02", "/platforms/orion"],
  ["USR-01", "/users"],
  ["USR-02", "/users/usr-001"],
  ["ORG-01", "/organizations"],
  ["ORG-02", "/organizations/org-platform"],
  ["SA-01", "/service-accounts"],
  ["SA-02", "/service-accounts/sa-platform-ci"],
  ["ROLE-01", "/roles"],
  ["ROLE-02", "/roles/role-platform"],
  ["WS-01", "/workspaces"],
  ["WS-02", "/workspaces/platform"],
  ["PAGE-01", "/pages"],
  ["PAGE-02", "/pages/platform~user-detail"],
  ["SVC-01", "/services"],
  ["SVC-02", "/services/identity-api"],
  ["EP-01", "/service-endpoints"],
  ["EP-02", "/service-endpoints/identity-api~detail"],
  ["DOMAIN-01", "/domains"],
  ["DOMAIN-02", "/domains/identity"],
  ["ACTION-01", "/actions"],
  ["ACTION-02", "/actions/identity~read-hr"],
  ["POL-01", "/policies"],
  ["POL-02", "/policies/policy-platform"],
  ["SYNC-01", "/resources"],
  ["KEY-01", "/api-keys"],
  ["KEY-02", "/api-keys/key-directory"],
  ["APR-01", "/approvals"],
  ["APR-02", "/approvals/new"],
  ["APR-03", "/approvals/approval-demo-001"],
  ["TPL-01", "/approvals?tab=templates"],
  ["TPL-02", "/approval-templates/api-key-issue"],
  ["TPL-03", "/approval-templates/new"],
  ["TPL-04", "/approval-templates/api-key-issue/edit"],
  ["KEY-03", "/api-keys", "issuance"],
  ["KEY-03-REVIEW", "/api-keys", "issuance-review"],
  ["SYNC-REVIEW", "/policies/policy-platform", "sync-review"],
  ["SYNC-IMPACT", "/policies/policy-platform", "sync-impact"],
].map(([id, route, action]) => ({ id, route, action: action ?? null }));
export const viewport = { width: 1440, height: 1100 };
export async function prepare(page, screen, base) {
  await page.goto(base + screen.route);
  await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByText("불러오는 중…", { exact: true })
    .waitFor({ state: "hidden" });
  if (screen.action?.startsWith("issuance")) {
    await page.getByRole("button", { name: "발급 요청", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("서비스 어카운트", { exact: true })
      .selectOption("sa-platform-ci");
    await dialog
      .getByLabel("관리 서비스", { exact: true })
      .selectOption("svc-orion");
    await dialog.getByRole("checkbox").first().check();
    await dialog
      .getByLabel("Secret name", { exact: true })
      .fill("orion/example/integration");
    await dialog.getByLabel("Secret value key", { exact: true }).fill("apiKey");
    await dialog
      .getByLabel("요청 사유", { exact: true })
      .fill("서비스 연동을 위한 접근 요청");
    if (screen.action === "issuance-review")
      await dialog.getByRole("button", { name: "검토", exact: true }).click();
    await dialog.getByRole("heading").first().click();
  }
  if (screen.action?.startsWith("sync")) {
    await page.getByRole("button", { name: "동기화", exact: true }).click();
    await page
      .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
      .click();
    if (screen.action === "sync-impact")
      await page.getByRole("tab", { name: "영향도", exact: true }).click();
  }
}
