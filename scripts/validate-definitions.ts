import { readFileSync, readdirSync } from "node:fs";
import {
  parseSources,
  validateCatalog,
} from "../src/features/definitions/model.ts";
const directory = "config/definitions";
const entities = parseSources(
  readdirSync(directory)
    .filter((n) => /\.ya?ml$/.test(n))
    .sort()
    .map((n) => readFileSync(`${directory}/${n}`, "utf8")),
);
const errors = validateCatalog(entities);
if (errors.length) throw Error(errors.join("\n"));
console.log(
  `Validated ${entities.length} scoped definitions and field references.`,
);

const { parseFiles, validate } =
  await import("../src/features/definition-contract/model.ts");
const root = "config/contract-v2";
const files = Object.fromEntries(
  readdirSync(root, { recursive: true })
    .filter((n): n is string => typeof n === "string" && /\.ya?ml$/.test(n))
    .map((n) => [n, readFileSync(`${root}/${n}`, "utf8")]),
);
const definitions = parseFiles(files);
const failures = validate(definitions);
if (failures.length) throw Error(failures.join("\n"));
console.log(`Validated ${definitions.length} new YAML contract definitions.`);
