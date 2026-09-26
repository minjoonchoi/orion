import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
async function files(dir) {
  return (
    await Promise.all(
      (await fs.readdir(dir, { withFileTypes: true })).map((item) =>
        item.isDirectory()
          ? files(path.join(dir, item.name))
          : path.join(dir, item.name),
      ),
    )
  ).flat();
}
const pages = (await files(path.join(root, "src/app")))
  .filter((f) => /\/page\.tsx$/.test(f))
  .sort(
    (a, b) => a.includes("[") - b.includes("[") || a.localeCompare(b, "en"),
  );
const configs = Object.fromEntries(
  await Promise.all(
    (await files(path.join(root, "config")))
      .filter((f) => /\.ya?ml$/.test(f))
      .map(async (f) => [
        "/" + path.relative(root, f),
        await fs.readFile(f, "utf8"),
      ]),
  ),
);
const runtime = path.join(root, "tools/demo/runtime.jsx");
const result = await build({
  entryPoints: ["tools/demo/entry.jsx"],
  bundle: true,
  write: false,
  outdir: "/demo",
  platform: "browser",
  format: "iife",
  minify: true,
  legalComments: "inline",
  jsx: "automatic",
  define: {
    "process.env": JSON.stringify({
      NODE_ENV: "production",
      ORION_DATA_SOURCE: "demo",
      ORION_ENVIRONMENT: "test",
      ORION_AUTH_LOGIN_URL: "https://orion.invalid/auth/login",
    }),
  },
  plugins: [
    {
      name: "orion-standalone",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(next\/(navigation|link|headers|cache)|server-only|node:crypto|node:fs\/promises|orion-demo-routes)$/,
          },
          (args) => {
            if (args.path.startsWith("next/")) return { path: runtime };
            if (args.path === "node:crypto")
              return {
                path: path.join(root, "tools/demo/adapters/crypto.mjs"),
              };
            return { path: args.path, namespace: "demo" };
          },
        );
        b.onLoad({ filter: /.*/, namespace: "demo" }, async (args) => {
          if (args.path === "server-only") return { contents: "export {};" };
          if (args.path === "node:fs/promises")
            return {
              contents: `const files=${JSON.stringify(configs)}; export async function readFile(p){if(!(p in files)) throw Error('Unknown fixture: '+p);return files[p];} export async function readdir(p){return Object.keys(files).filter(f=>f.startsWith(p+'/')).map(f=>f.slice(p.length+1));}`,
            };
          const rows = await Promise.all(
            pages.map(async (file, i) => {
              const route =
                file
                  .replace(root + "/src/app", "")
                  .replace(/\/\([^/]+\)/g, "")
                  .replace(/\/page\.tsx$/, "") || "/";
              const keys = [...route.matchAll(/\[([^\]]+)\]/g)].map(
                (m) => m[1],
              );
              const regex = "^" + route.replace(/\[[^\]]+\]/g, "([^/]+)") + "$";
              return {
                import: `import Page${i} from ${JSON.stringify(file)};`,
                entry: `{pattern:new RegExp(${JSON.stringify(regex)}),keys:${JSON.stringify(keys)},page:Page${i},client:${(await fs.readFile(file, "utf8")).startsWith('"use client"')}}`,
              };
            }),
          );
          return {
            contents:
              rows.map((r) => r.import).join("\n") +
              "\nexport default [" +
              rows.map((r) => r.entry).join(",") +
              "];",
            resolveDir: root,
          };
        });
        b.onLoad({ filter: /\.[tj]sx?$/ }, async (args) => {
          if (!args.path.startsWith(path.join(root, "src"))) return;
          let contents = (await fs.readFile(args.path, "utf8")).replaceAll(
            "process.cwd()",
            '""',
          );
          let needsRuntime = false;
          if (/window\.location\.(search|pathname|hash)/.test(contents)) {
            contents = contents.replace(
              /window\.location\.(search|pathname|hash)/g,
              "demoLocation.$1",
            );
            needsRuntime = true;
          }
          if (args.path.endsWith("i18n/provider.tsx")) {
            contents = contents.replace(
              /document\.cookie = `[^`]+`;\s*location\.reload\(\);/,
              "demoLocale(event.target.value);",
            );
            needsRuntime = true;
          }
          if (args.path.endsWith("auth/logout-button.tsx")) {
            contents = contents.replace(
              'location.replace("/login")',
              'navigate("/login", true)',
            );
            needsRuntime = true;
          }
          if (needsRuntime)
            contents =
              `import {demoLocation,demoLocale,navigate} from ${JSON.stringify(runtime)};\n` +
              contents;
          return {
            contents,
            loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
          };
        });
      },
    },
  ],
});
const js = result.outputFiles
  .find((f) => f.path.endsWith(".js"))
  .text.replace(/<\/script/gi, "<\\/script");
const css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
const sources = [
  ...(await files(path.join(root, "src"))),
  ...(await files(path.join(root, "tools/demo"))),
  ...(await files(path.join(root, "config"))),
  ...(await files(path.join(root, "docs/screens"))),
  path.join(root, "AGENTS.md"),
  path.join(root, "scripts/build-demo.mjs"),
  path.join(root, "package-lock.json"),
].sort();
const hash = createHash("sha256");
for (const file of sources) {
  hash.update(path.relative(root, file));
  hash.update(await fs.readFile(file));
}
const fingerprint = hash.digest("hex");
const html =
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="orion-source" content="${fingerprint}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Orion · 통합 UI 데모</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`.replace(
    /[ \t]+$/gm,
    "",
  );
const output = path.join(root, "docs/demo/orion.html");
if (process.argv.includes("--check")) {
  if ((await fs.readFile(output, "utf8")) !== html)
    throw Error(
      "docs/demo/orion.html is stale. Run npm run demo:build and commit the result.",
    );
  console.log("Standalone HTML matches source, specs and build inputs.");
} else {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, html);
  console.log(
    `Built ${pages.length} routes, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB: docs/demo/orion.html`,
  );
}
