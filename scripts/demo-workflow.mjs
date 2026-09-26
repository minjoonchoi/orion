import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = process.cwd();
const command = process.argv[2];
const stateFile = "docs/demo/workflow.json";
const overrides = "prototype/overrides";
async function files(directory) {
  try {
    return (
      await Promise.all(
        (await fs.readdir(directory, { withFileTypes: true })).map(
          async (entry) => {
            if (entry.isSymbolicLink())
              throw Error("Symlinks are not allowed in proposal inputs");
            return entry.isDirectory()
              ? files(path.join(directory, entry.name))
              : path.join(directory, entry.name);
          },
        ),
      )
    )
      .flat()
      .sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
const digest = (data) => createHash("sha256").update(data).digest("hex");
async function fingerprint(paths) {
  const hash = createHash("sha256");
  for (const file of paths.sort()) {
    hash.update(file);
    hash.update(await fs.readFile(file));
  }
  return hash.digest("hex");
}
async function baseHash() {
  return fingerprint(
    (await Promise.all(["src", "config", "docs/screens"].map(files))).flat(),
  );
}
async function buildInputs() {
  return fingerprint([
    ...(await files("tools/demo")),
    "AGENTS.md",
    "scripts/build-demo.mjs",
    "scripts/demo-screens.mjs",
    "scripts/demo-archive.py",
    "package-lock.json",
    "tsconfig.json",
  ]);
}
async function proposal() {
  const paths = await files(overrides);
  for (const file of paths) {
    const target = path.relative(overrides, file).split(path.sep).join("/");
    if (!/^(src|config|docs\/screens)\//.test(target))
      throw Error("Unsupported override: " + target);
  }
  return { paths, hash: await fingerprint(paths) };
}
async function state() {
  return JSON.parse(await fs.readFile(stateFile, "utf8"));
}
async function save(value) {
  await fs.mkdir("docs/demo", { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(value, null, 2) + "\n");
}
function run(script, args = [], cwd = root) {
  execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd,
    stdio: "inherit",
  });
}
if (command === "begin") {
  let existing;
  try {
    existing = await state();
  } catch {
    /* First proposal. */
  }
  if (existing && existing.status !== "applied")
    throw Error(
      "A proposal is already active. Finish or explicitly archive it first.",
    );
  if ((await files(overrides)).length)
    throw Error("Archive previous overrides before starting a new proposal.");
  await fs.mkdir(overrides, { recursive: true });
  await save({ status: "draft", base: await baseHash(), approval: null });
  console.log(
    "Edit only prototype/overrides/{src,config,docs/screens}/… then run demo:preview.",
  );
} else if (command === "preview") {
  const s = await state(),
    p = await proposal();
  if (s.status === "applied") throw Error("Start a new proposal first.");
  if (s.base !== (await baseHash()))
    throw Error(
      "Product or specs changed during review. Reconcile the proposal first.",
    );
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "orion-preview-"));
  try {
    for (const directory of ["src", "config", "tools/demo", "docs/screens"]) {
      await fs.mkdir(path.dirname(path.join(temp, directory)), {
        recursive: true,
      });
      await fs.cp(directory, path.join(temp, directory), { recursive: true });
    }
    for (const file of [
      "AGENTS.md",
      "scripts/build-demo.mjs",
      "package-lock.json",
      "package.json",
      "tsconfig.json",
    ]) {
      await fs.mkdir(path.dirname(path.join(temp, file)), { recursive: true });
      await fs.copyFile(file, path.join(temp, file));
    }
    await fs.symlink(
      path.join(root, "node_modules"),
      path.join(temp, "node_modules"),
      "dir",
    );
    for (const file of p.paths) {
      const target = path.join(temp, path.relative(overrides, file));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(file, target);
    }
    run("scripts/build-demo.mjs", [], temp);
    await fs.copyFile(
      path.join(temp, "docs/demo/orion.html"),
      "docs/demo/preview.html",
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
  run("scripts/demo-screens.mjs", ["--preview"]);
  await save({
    ...s,
    status: "review",
    proposal: p.hash,
    buildInputs: await buildInputs(),
    html: digest(await fs.readFile("docs/demo/preview.html")),
    screens: digest(
      await fs.readFile("docs/demo/preview-screenshots/manifest.json"),
    ),
    approval: null,
  });
  console.log(
    "Review preview.html and cached screenshots with the user. Do not apply or create a product PR yet.",
  );
} else if (command === "approve") {
  const evidence = process.argv.slice(3).join(" ").trim();
  const s = await state();
  if (s.status !== "review" || !evidence)
    throw Error(
      "An explicit user confirmation of this review revision is required; pass its message reference/text.",
    );
  if (
    s.buildInputs !== (await buildInputs()) ||
    s.proposal !== (await proposal()).hash ||
    s.html !== digest(await fs.readFile("docs/demo/preview.html"))
  )
    throw Error("Proposal changed after review.");
  run("scripts/demo-screens.mjs", ["--preview", "--check"]);
  if (
    s.screens !==
    digest(await fs.readFile("docs/demo/preview-screenshots/manifest.json"))
  )
    throw Error("Review screenshots changed.");
  await fs.copyFile("docs/demo/preview.html", "docs/demo/approved.html");
  await save({
    ...s,
    status: "approved",
    approval: { evidence, html: s.html, at: new Date().toISOString() },
  });
} else if (command === "apply") {
  const s = await state(),
    p = await proposal();
  if (s.status !== "approved" || !s.approval)
    throw Error(
      "User confirmation is missing. Product files have not been changed.",
    );
  if (
    s.buildInputs !== (await buildInputs()) ||
    s.base !== (await baseHash()) ||
    s.proposal !== p.hash ||
    s.approval.html !== digest(await fs.readFile("docs/demo/approved.html"))
  )
    throw Error("Approved inputs changed. Review again before applying.");
  for (const file of p.paths) {
    const target = path.relative(overrides, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }
  run("scripts/build-demo.mjs");
  if (s.approval.html !== digest(await fs.readFile("docs/demo/orion.html")))
    throw Error(
      "Product HTML differs from the approved HTML. Do not open a PR; investigate the difference.",
    );
  run("scripts/demo-screens.mjs");
  await save({ ...s, status: "applied", applied: await baseHash() });
  console.log(
    "Run app/approved-HTML visual and interaction tests, then create the product PR.",
  );
} else if (command === "check") {
  let s;
  try {
    s = await state();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (!s) {
    if ((await files(overrides)).length)
      throw Error("Unreviewed overrides exist.");
    console.log(
      "No active product proposal; workflow infrastructure baseline.",
    );
  } else {
    if (s.status !== "applied" || !s.approval)
      throw Error(
        "Review/approval/product application is incomplete. Do not create a product PR.",
      );
    if (
      s.applied !== (await baseHash()) ||
      s.approval.html !== digest(await fs.readFile("docs/demo/orion.html")) ||
      s.approval.html !== digest(await fs.readFile("docs/demo/approved.html"))
    )
      throw Error("Product differs from approved revision.");
    console.log("Product matches the explicitly approved HTML revision.");
  }
} else
  throw Error(
    "Expected begin | preview | approve <confirmation evidence> | apply | check",
  );
