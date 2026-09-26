import { readFileSync } from "node:fs";
import { parseBundle } from "../src/features/resource-sync/model.ts";
import { parseBundle as parsePolicyBundle } from "../src/features/policy-sync/model.ts";

const resources = readFileSync("config/resources/orion-resources.yaml", "utf8");
parseBundle(resources, "development", "ap-northeast-2");

const policies = readFileSync("config/policies/orion-policies.yaml", "utf8");
parsePolicyBundle(policies, "development", "ap-northeast-2");

console.log("Resource and policy YAML schema and scope are valid.");
