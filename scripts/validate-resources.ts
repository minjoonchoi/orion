import { readFileSync } from "node:fs";
import { parseBundle } from "../src/features/resource-sync/model.ts";
const source = readFileSync("config/resources/orion-resources.yaml", "utf8");
parseBundle(source, "development", "ap-northeast-2");
console.log("Resource YAML schema and scope are valid.");
