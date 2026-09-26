import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
const html = pathToFileURL(path.resolve("docs/demo/orion.html")).href;

test("standalone uses the same menu pages and templates as the application without network", async ({
  page,
  context,
}) => {
  const offline = await context.newPage();
  const errors: string[] = [],
    requests: string[] = [];
  offline.on("pageerror", (e) => errors.push(e.message));
  offline.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  for (const route of [
    "/",
    "/platforms",
    "/users",
    "/organizations",
    "/service-accounts",
    "/roles",
    "/workspaces",
    "/services",
    "/domains",
    "/policies",
    "/resources",
    "/api-keys",
    "/approvals",
    "/approvals?tab=templates",
    "/approvals/new",
    "/approval-templates/api-key-issue/edit",
  ]) {
    await page.goto(route);
    await offline.goto(html + "#" + route);
    await expect(offline.locator("main h1")).toHaveText(
      await page.locator("main h1").innerText(),
    );
    await expect(
      offline.getByRole("navigation", { name: "주 메뉴", exact: true }),
    ).toHaveText(
      await page
        .getByRole("navigation", { name: "주 메뉴", exact: true })
        .innerText(),
      { useInnerText: true },
    );
    await expect(
      offline.getByText(/데모 사용자|예제 모드|실제 사내 계정을 사용하지 않는/),
    ).toHaveCount(0);
    if (
      ["/approvals", "/approvals?tab=templates", "/approvals/new"].includes(
        route,
      )
    ) {
      await expect(offline.locator("main")).toHaveText(
        await page.locator("main").innerText(),
        { useInnerText: true },
      );
    }
  }
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});

test("standalone template, request, relationships, language and sync interactions work", async ({
  page,
}) => {
  await page.goto(html + "#/approvals");
  await page.getByRole("tab", { name: "결재 템플릿", exact: true }).click();
  await page.getByRole("link", { name: "템플릿 추가", exact: true }).click();
  await page.getByLabel("이름", { exact: true }).fill("통합 HTML 요청");
  await page.getByRole("button", { name: "템플릿 생성", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "통합 HTML 요청",
  );
  await page
    .getByRole("link", { name: "이 템플릿으로 작성", exact: true })
    .click();
  await page
    .getByLabel("서비스 어카운트", { exact: true })
    .selectOption("sa-platform-ci");
  await page
    .getByLabel("관리 서비스", { exact: true })
    .selectOption("svc-orion");
  await page.getByRole("checkbox").first().check();
  await page
    .getByLabel("Secret name", { exact: true })
    .fill("orion/offline/test");
  await page.getByLabel("Secret value key", { exact: true }).fill("apiKey");
  await page
    .getByLabel("요청 사유", { exact: true })
    .fill("HTML에서 실제 요청 로직 확인");
  await page.getByRole("button", { name: "검토", exact: true }).click();
  await page.getByRole("button", { name: "결재 요청", exact: true }).click();
  await expect(page.locator("[data-detail-summary]")).toContainText(
    "결재 진행",
  );
  await page
    .getByRole("navigation", { name: "주 메뉴", exact: true })
    .getByRole("link", { name: "사용자", exact: true })
    .click();
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page.getByRole("tab", { name: /조직/ })).toBeVisible();
  await page.getByLabel("Language / 언어").selectOption("en");
  await expect(
    page.getByRole("navigation", { name: "Main navigation", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language / 언어").selectOption("ko");
  await page
    .getByRole("navigation", { name: "주 메뉴", exact: true })
    .getByRole("link", { name: "변경 관리", exact: true })
    .click();
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("standalone policy diff, impact and sync use the actual command model", async ({
  page,
}) => {
  await page.goto(html + "#/policies/policy-platform");
  await expect(
    page.getByRole("row").filter({ hasText: "/phone" }),
  ).toContainText("미포함");
  await page.getByRole("button", { name: "동기화", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "변경사항 및 영향도 검토", exact: true })
    .click();
  await expect(dialog.getByRole("tab", { name: "YAML diff" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await dialog.getByRole("tab", { name: "영향도", exact: true }).click();
  await expect(dialog).toContainText("반환 필드 추가: phone");
  await dialog
    .getByRole("checkbox", { name: "변경사항과 영향 범위를 확인했습니다." })
    .check();
  await dialog
    .getByRole("button", { name: "동기화 적용", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "/phone" }),
  ).toContainText("keep-last");
});
