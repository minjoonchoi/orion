import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { screens, viewport, prepare } from "../tools/demo/screens.mjs";
const preview = process.argv.includes("--preview");
const html = path.resolve(`docs/demo/${preview ? "preview" : "orion"}.html`);
const directory = path.resolve(
  `docs/demo/${preview ? "preview-screenshots" : "screenshots"}`,
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const inputs = {
  html: hash(await fs.readFile(html)),
  registry: hash(await fs.readFile("tools/demo/screens.mjs")),
  capture: hash(await fs.readFile("scripts/demo-screens.mjs")),
  viewport,
  locale: "ko-KR",
};
let previous;
try {
  previous = JSON.parse(
    await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
  );
} catch {
  /* Initial capture. */
}
if (previous) {
  try {
    if (
      !(
        await Promise.all(
          previous.screens.map((s) =>
            fs.access(path.join(directory, s.file)).then(
              () => true,
              () => false,
            ),
          ),
        )
      ).every(Boolean)
    )
      execFileSync("python3", ["scripts/demo-archive.py", "unpack", directory]);
  } catch {
    /* Missing/corrupt assets are rejected or recaptured below. */
  }
}
async function valid() {
  if (JSON.stringify(previous?.inputs) !== JSON.stringify(inputs)) return false;
  if (
    previous.archive !==
    hash(
      await fs
        .readFile(path.join(directory, "screens.zip"))
        .catch(() => Buffer.alloc(0)),
    )
  )
    return false;
  if (!screens.every((s) => previous.screens.some((r) => r.id === s.id)))
    return false;
  for (const item of previous.screens) {
    try {
      if (
        hash(await fs.readFile(path.join(directory, item.file))) !== item.sha256
      )
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
if (await valid()) {
  console.log(`Reusing ${previous.screens.length} current screenshots.`);
  process.exit(0);
}
if (process.argv.includes("--check"))
  throw Error(
    "Screenshots are missing or stale. Run npm run demo:screens" +
      (preview ? " -- --preview" : ""),
  );
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const records = [];
try {
  for (const screen of screens) {
    const context = await browser.newContext({ viewport, locale: "ko-KR" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await prepare(page, screen, pathToFileURL(html).href + "#");
    async function save(id, state) {
      const file = id + ".png";
      const image = await page.screenshot({
        animations: "disabled",
        fullPage: !screen.action,
      });
      const digest = hash(image);
      const old = previous?.screens.find((s) => s.id === id);
      let same = false;
      try {
        same =
          old?.sha256 === digest &&
          hash(await fs.readFile(path.join(directory, file))) === digest;
      } catch {
        /* New screen. */
      }
      if (!same) await fs.writeFile(path.join(directory, file), image);
      records.push({
        id,
        route: screen.route,
        action: screen.action,
        state,
        file,
        sha256: digest,
      });
    }
    await save(screen.id, "default");
    if (!screen.action) {
      const tabs = page.getByRole("tab");
      const count = await tabs.count();
      for (let i = 0; i < count; i++) {
        const name = await tabs.nth(i).innerText();
        await tabs.nth(i).click();
        await page.evaluate(() => document.fonts.ready);
        await save(`${screen.id}-TAB-${i + 1}`, name);
      }
    }
    if (errors.length) throw Error(screen.id + ": " + errors.join("\n"));
    await context.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  path.join(directory, "manifest.json"),
  JSON.stringify({ inputs, screens: records }, null, 2) + "\n",
);
// Remove retired screens only after a complete, successful capture.
for (const old of previous?.screens ?? [])
  if (!records.some((r) => r.file === old.file))
    await fs.rm(path.join(directory, old.file), { force: true });
console.log(`Saved ${records.length} screen states in ${directory}`);

execFileSync("python3", ["scripts/demo-archive.py", "pack", directory]);
const manifest = JSON.parse(
  await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
);
manifest.archive = hash(await fs.readFile(path.join(directory, "screens.zip")));
await fs.writeFile(
  path.join(directory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
