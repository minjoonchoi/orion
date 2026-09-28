import { build } from "esbuild";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { screens, contractScreens, prepare } from "../tools/demo/screens.mjs";
const base = process.env.ORION_REVIEW_URL ?? "http://127.0.0.1:3102";
const html = pathToFileURL(path.resolve("docs/demo/preview.html")).href + "#";
const dir = "docs/demo/next-review";
await fs.mkdir(dir, { recursive: true });
const ids = [
  "POL-V2-LIST",
  "POL-V2-PAGE",
  "POL-V2-DIRECT",
  "SA-V2-POLICIES",
  "ROL-V2-REVIEW",
  "YAML-ACTION-DETAIL",
  "CHK-SPACING",
  "REQ-01-REVIEW",
  "REQ-02-SUBMITTED",
];
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "orion-next-fixtures-"));
const reviewDir = process.env.ORION_REVIEW_DIR ?? "/tmp/orion-policy-check";
await build({
  stdin: {
    contents: `export * from './src/features/approval-workflow/model.ts';export {seed} from './src/features/approval-workflow/demo.ts';export {demoDirectory} from './src/features/platforms/demo.ts';`,
    resolveDir: reviewDir,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: path.join(temp, "model.mjs"),
});
const { seed, apply, demoDirectory } = await import(
  pathToFileURL(path.join(temp, "model.mjs")).href
);
const now = new Date().toISOString(),
  directory = demoDirectory();
let state = seed();
state = apply(
  state,
  {
    kind: "access-request",
    requestId: "approval-next-review",
    platformId: "orion",
    roleId: "role-security",
    reason: "보안 검토를 위한 권한 신청",
    expiresAt: "2026-12-31",
  },
  state.revision,
  now,
  "",
  directory,
);
state.actorId = "usr-002";
const lead = structuredClone(state);
state = apply(
  state,
  { kind: "decide", id: "approval-next-review", decision: "approved" },
  state.revision,
  now,
);
state.actorId = "usr-003";
const security = structuredClone(state);
state = apply(
  state,
  { kind: "decide", id: "approval-next-review", decision: "approved" },
  state.revision,
  now,
);
const ready = structuredClone(state);
const entries = Object.entries({ lead, security, ready }).map(
  ([key, state]) => ["review-" + key, { state, at: Date.now() }],
);
const preload = path.join(temp, "sessions.cjs");
await fs.writeFile(
  preload,
  "globalThis.orionApprovalSessions = new Map(" +
    JSON.stringify(entries) +
    ");",
);
const server = spawn(
  process.execPath,
  [
    path.resolve("node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3102",
  ],
  {
    cwd: reviewDir,
    env: {
      ...process.env,
      ORION_DATA_SOURCE: "demo",
      ORION_ENVIRONMENT: "test",
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS ?? "",
        "--import=" + preload,
      ].join(" "),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stderr.on("data", (b) => process.stderr.write(b));
await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(Error("Server readiness timeout")),
    30000,
  );
  server.stdout.on("data", (b) => {
    if (String(b).includes("Ready")) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on("exit", (code) => {
    clearTimeout(timer);
    reject(Error("Server exited " + code));
  });
});
const browser = await chromium.launch();
const results = [],
  errors = [];
try {
  for (const id of ids) {
    const screen = [...screens, ...contractScreens].find((s) => s.id === id);
    assert.ok(screen, id);
    const contexts = await Promise.all(
      [0, 1].map(() =>
        browser.newContext({
          viewport: { width: 1440, height: 1100 },
          locale: "ko-KR",
        }),
      ),
    );
    try {
      const pages = await Promise.all(contexts.map((c) => c.newPage()));
      pages.forEach((p) =>
        p.on("pageerror", (e) => errors.push({ id, message: e.message })),
      );
      for (const [i, url] of [base, html].entries()) {
        await prepare(pages[i], screen, url);
        await pages[i].evaluate(() => document.fonts.ready);
        await pages[i].evaluate(() => {
          if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
        });
      }
      assert.equal(
        await pages[0].locator("main").innerText(),
        await pages[1].locator("main").innerText(),
        id + " text",
      );
      const captures = await Promise.all(
        pages.map((p) =>
          p.screenshot({ animations: "disabled", fullPage: !screen.action }),
        ),
      );
      const [a, b] = captures.map((v) => PNG.sync.read(v));
      assert.deepEqual(
        [a.width, a.height],
        [b.width, b.height],
        id + " dimensions",
      );
      const diff = new PNG({ width: a.width, height: a.height });
      const ratio =
        pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
          threshold: 0.1,
        }) /
        (a.width * a.height);
      await fs.writeFile(`${dir}/${id}-next.png`, captures[0]);
      await fs.writeFile(`${dir}/${id}-html.png`, captures[1]);
      if (ratio > 0.001)
        await fs.writeFile(`${dir}/${id}-difference.png`, PNG.sync.write(diff));
      results.push({ id, difference: ratio, passed: ratio <= 0.001 });
      console.log(id, ratio);
      assert.ok(ratio <= 0.001, id + " pixel difference " + ratio);
      if (id === "REQ-02-SUBMITTED") {
        // Real Next Server Action, persistence across reload, then cancellation.
        const p = pages[0];
        await p.reload();
        const table = p.getByRole("table", {
          name: "내 권한 신청",
          exact: true,
        });
        await table.getByText("결재 진행", { exact: true }).waitFor();
        await table
          .getByRole("link", { name: "보안 검토자", exact: true })
          .click();
        await p
          .getByRole("heading", {
            name: "권한 신청 · 보안 검토자",
            exact: true,
          })
          .waitFor();
        await p.getByRole("tab", { name: "결재선", exact: true }).click();
        assert.equal(
          await p.getByRole("button", { name: "승인", exact: true }).count(),
          0,
        );
        await p.goto(base + "/my-access?tab=requests");
        await table
          .getByRole("button", { name: "신청 취소", exact: true })
          .click();
        await p
          .getByRole("dialog")
          .getByRole("button", { name: "취소 확정", exact: true })
          .click();
        await p.getByRole("dialog").waitFor({ state: "hidden" });
        await table.getByText("신청 취소", { exact: true }).waitFor();
        await p.reload();
        await table.getByText("신청 취소", { exact: true }).waitFor();
        await p.screenshot({
          path: dir + "/cancelled-next.png",
          fullPage: true,
        });
        results.push({
          id: "NEXT-SUBMIT-RELOAD-DOCUMENT-CANCEL-RELOAD",
          passed: true,
        });
      }
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  }
  for (const [session, label, expected] of [
    ["lead", "승인", "결재 진행"],
    ["security", "합의", "승인 완료"],
    ["ready", "권한 반영 검토", "처리 완료"],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      locale: "ko-KR",
    });
    try {
      await ctx.addCookies([
        {
          name: "orion-approval-workflow",
          value: "review-" + session,
          url: base,
        },
      ]);
      const p = await ctx.newPage();
      p.on("pageerror", (e) =>
        errors.push({ id: session, message: e.message }),
      );
      await p.goto(
        base +
          "/approvals/approval-next-review?tab=" +
          (session === "ready" ? "execution" : "line"),
      );
      await p.getByRole("button", { name: label, exact: true }).click();
      await p
        .getByRole("dialog")
        .getByRole("button", {
          name: session === "ready" ? "권한 반영" : "승인·합의 확정",
          exact: true,
        })
        .click();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
      await p.reload();
      await p.getByText(expected, { exact: true }).first().waitFor();
      await p.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
      await p.screenshot({
        path: `${dir}/NEXT-${session}.png`,
        fullPage: true,
      });
      results.push({ id: "NEXT-SERVER-ACTION-" + session, passed: true });
      console.log("Server action:", session, "passed");
    } finally {
      await ctx.close();
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.kill();
  await fs.rm(temp, { recursive: true, force: true });
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  await fs.writeFile(
    dir + "/manifest.json",
    JSON.stringify(
      {
        html: hash(await fs.readFile("docs/demo/preview.html")),
        base,
        results,
        errors,
        screens: await Promise.all(
          (await fs.readdir(dir))
            .filter((n) => n.endsWith(".png"))
            .map(async (file) => ({
              file,
              sha256: hash(await fs.readFile(dir + "/" + file)),
            })),
        ),
      },
      null,
      2,
    ) + "\n",
  );
}
