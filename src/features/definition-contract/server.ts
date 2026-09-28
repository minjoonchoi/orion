import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { deployment } from "@/lib/api/server";
import { parseFiles, validate } from "./model";
export async function contractSources(): Promise<Record<
  string,
  string
> | null> {
  if (deployment().mode !== "demo") return null;
  const root = process.cwd() + "/config/contract-v2";
  const names = (await readdir(root, { recursive: true }))
    .filter((n) => /\.ya?ml$/.test(n))
    .sort();
  const pairs = await Promise.all(
    names.map(
      async (name) =>
        [name, await readFile(root + "/" + name, "utf8")] as const,
    ),
  );
  const files = Object.fromEntries(pairs);
  const errors = validate(parseFiles(files));
  if (errors.length) throw Error(errors.join("; "));
  return files;
}
