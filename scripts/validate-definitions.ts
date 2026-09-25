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
