import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("approval creation requires explicit type and template selection", async ({
  page,
}) => {
  await page.goto("/approvals");
  await expect(
    page.getByRole("button", { name: "발급 요청", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "결재 작성", exact: true }).click();
  const start = page.getByRole("button", { name: "작성 시작", exact: true });
  await expect(start).toBeDisabled();
  await page.getByLabel("결재 유형", { exact: true }).selectOption("issue");
  await expect(start).toBeDisabled();
  await page
    .getByLabel("결재 템플릿", { exact: true })
    .selectOption("api-key-issue");
  await start.click();
  await expect(
    page.getByLabel("서비스 어카운트", { exact: true }),
  ).toBeVisible();
});

test("issuance modal keeps endpoint selection through searches and submits an approval", async ({
  page,
}) => {
  await page.goto("/api-keys");
  await page.getByRole("button", { name: "발급 요청", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(page).toHaveURL(/api-keys$/);
  await dialog
    .getByLabel("서비스 어카운트", { exact: true })
    .selectOption("sa-platform-ci");
  await dialog
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  const first = dialog.getByRole("checkbox").first();
  const label = await first.getAttribute("aria-label");
  await first.check();
  await dialog
    .getByLabel("엔드포인트 검색", { exact: true })
    .fill("no-such-endpoint");
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await dialog.getByLabel("엔드포인트 검색", { exact: true }).fill("");
  await expect(
    dialog.getByRole("checkbox", { name: label!, exact: true }),
  ).toBeChecked();
  await dialog
    .getByRole("button", { name: "선택만 보기 (1)", exact: true })
    .click();
  await expect(dialog.getByRole("checkbox")).toHaveCount(1);
  await dialog
    .getByLabel("Secret name", { exact: true })
    .fill("orion/authoring/test");
  await dialog.getByLabel("Secret value key", { exact: true }).fill("apiKey");
  await dialog
    .getByLabel("요청 사유", { exact: true })
    .fill("검색한 엔드포인트 접근 요청");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "검토", exact: true }).click();
  await dialog.getByRole("button", { name: "결재 요청", exact: true }).click();
  await expect(page).toHaveURL(/approvals\/[a-f0-9-]+$/);
  await expect(page.locator("[data-detail-summary]")).toContainText(
    "결재 진행",
  );
});

test("template creation and editing share tabbed pages", async ({ page }) => {
  await page.goto("/approval-templates/new");
  await page.getByLabel("이름", { exact: true }).fill("공통 편집 검증");
  await page.getByRole("tab", { name: "입력 필드", exact: true }).click();
  const field = page
    .getByRole("tabpanel")
    .filter({ visible: true })
    .getByRole("textbox")
    .first();
  await field.fill("서비스 계정 선택");
  await page.getByRole("tab", { name: "결재선", exact: true }).click();
  await page.getByRole("tab", { name: "입력 필드", exact: true }).click();
  await expect(field).toHaveValue("서비스 계정 선택");
  await page.getByRole("button", { name: "템플릿 생성", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "공통 편집 검증",
  );
  await page.getByRole("link", { name: "템플릿 수정", exact: true }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel("이름", { exact: true })).toHaveValue(
    "공통 편집 검증",
  );
});

test("non-admins cannot open template creation or editing pages", async ({
  page,
}) => {
  await page.goto("/approvals");
  await page.getByLabel("데모 사용자", { exact: true }).selectOption("usr-014");
  await expect(page.locator(".wf-demo")).toHaveAttribute(
    "data-actor-id",
    "usr-014",
  );
  for (const path of [
    "/approval-templates/new",
    "/approval-templates/api-key-issue/edit",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/forbidden/);
  }
});
