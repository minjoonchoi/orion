import { readFileSync } from "node:fs";
import { parseBundle } from "../src/features/resource-sync/model.ts";
const source = readFileSync("config/resources/orion-resources.yaml", "utf8");
parseBundle(source, "development", "ap-northeast-2");
if (source !== readFileSync("deploy/resource-catalog/resources.yaml", "utf8"))
  throw Error("Argo payload differs from source YAML");
console.log("Resource YAML schema, scope and deployment payload match.");
