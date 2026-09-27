import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
const base = pathToFileURL(path.resolve("docs/demo/preview.html")).href + "#";
const report = { checks: [], errors: [], accessibility: [], viewports: [] };
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await ctx.newPage();
page.on("pageerror", (e) => report.errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const go = async (route) => {
  await page.goto(base + route);
  await page.locator("main h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
};
try {
  await go("/platforms/orion?tab=members");
  await page
    .getByRole("checkbox", { name: "김다온 선택", exact: true })
    .check();
  await button("중지").click();
  await page
    .getByRole("textbox", { name: "변경 사유", exact: true })
    .fill("업무 변경");
  await button("변경 내용 검토").click();
  await button("확인 후 적용").click();
  assert.match(await page.getByRole("status").innerText(), /중지 완료/);
  await go("/access-check?user=usr-002&platform=orion&action=identity~read-hr");
  await button("접근 확인").click();
  assert.match(
    await page.locator(".access-result").innerText(),
    /멤버십이 중지/,
  );
  report.checks.push(
    "멤버 중지 → 같은 사용자의 접근 거부, 페이지 간 상태 공유",
  );
  await go("/platforms/finance?tab=members");
  assert.equal(
    await page
      .getByRole("row")
      .filter({ hasText: "강민서" })
      .getByText("활성", { exact: true })
      .count(),
    1,
  );
  report.checks.push("다른 플랫폼 멤버 상태 보존");
  await go("/roles/role-finance?tab=policies");
  await button("정책 및 만료 관리").click();
  await page
    .getByRole("checkbox", { name: "정산 조회", exact: true })
    .uncheck();
  await button("변경 내용 검토").click();
  await button("확인 후 적용").click();
  await go(
    "/access-check?user=usr-013&platform=finance&action=settlement~read",
  );
  await button("접근 확인").click();
  assert.match(
    await page.locator(".access-result").innerText(),
    /정책이 없습니다/,
  );
  report.checks.push("정책 해제 → 접근 결과 갱신");
  await go("/roles");
  await button("역할 생성").click();
  await page
    .getByRole("textbox", { name: "역할 이름", exact: true })
    .fill("결산 점검자");
  await page
    .getByRole("textbox", { name: "설명", exact: true })
    .fill("분기 결산 점검 업무");
  await button("변경 내용 검토").click();
  await button("확인 후 적용").click();
  await page
    .getByRole("heading", { name: "결산 점검자", exact: true })
    .waitFor();
  report.checks.push("역할 생성 → 신규 상세 이동");
  await go("/access-requests/new");
  await page
    .getByRole("combobox", { name: "신청 역할", exact: true })
    .selectOption("role-security");
  await page
    .getByRole("textbox", { name: "신청 사유", exact: true })
    .fill("보안 검토");
  await button("신청 내용 검토").click();
  await button("신청 제출").click();
  await page
    .getByRole("heading", { name: "내 접근 권한", exact: true })
    .waitFor();
  assert.match(await page.locator("main").innerText(), /검토 대기/);
  report.checks.push("신청 제출 → 내 신청 내역");
  await go("/access-check?user=usr-001&platform=orion&action=review~security");
  await button("접근 확인").click();
  assert.match(await page.locator(".access-result").innerText(), /접근 거부/);
  report.checks.push("신청만으로 권한 부여되지 않음");
  await go("/access-requests/new");
  await page
    .getByRole("combobox", { name: "신청 역할", exact: true })
    .selectOption("role-security");
  await page
    .getByRole("textbox", { name: "신청 사유", exact: true })
    .fill("중복 요청");
  assert.equal(await button("신청 내용 검토").isEnabled(), false);
  report.checks.push("진행 중인 동일 역할 신청 차단");
  await go("/my-access?tab=requests");
  await page.getByRole("button", { name: /REQ-/ }).click();
  await button("신청 취소").click();
  await button("취소 확정").click();
  assert.match(await page.locator("main").innerText(), /신청 취소/);
  report.checks.push("신청 취소 확인 → 상태 반영");
  // Refresh explicitly resets the prototype adapter.
  await page.reload();
  await page.locator("main h1").waitFor();
  assert.match(
    await page.locator("main").innerText(),
    /아직 신청한 권한이 없습니다/,
  );
  report.checks.push("새로고침 시 검토용 메모리 상태 초기화");
  for (const route of [
    "/platforms/orion",
    "/roles/role-platform?tab=policies",
    "/users/usr-001?tab=access",
    "/access-check",
    "/access-requests/new",
    "/my-access",
  ]) {
    await go(route);
    const result = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    report.accessibility.push({
      route,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
      })),
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/platforms/orion",
    "/roles/role-platform?tab=policies",
    "/users/usr-001?tab=access",
    "/access-check",
    "/access-requests/new",
    "/my-access",
  ]) {
    await go(route);
    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    report.viewports.push({ route, ...dimensions });
    assert.ok(
      dimensions.scroll <= dimensions.width + 1,
      `Mobile overflow: ${route}`,
    );
  }
  assert.equal(report.errors.length, 0);
  assert.equal(report.accessibility.flatMap((x) => x.violations).length, 0);
  report.checks.push("6개 주요 화면 자동 접근성·모바일 가로 넘침 검사");
} finally {
  await fs.writeFile(
    "docs/demo/access-ui-validation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
