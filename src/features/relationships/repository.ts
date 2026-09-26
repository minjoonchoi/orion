import "server-only";
import { deployment, relationData } from "@/lib/api/server";
import type { RelationKind, RelatedGroup } from "./repository.mock";
export type {
  RelationKind,
  RelatedGroup,
  RelatedRecord,
} from "./repository.mock";
export async function getRelatedGroups(
  kind: RelationKind,
  id: string,
): Promise<RelatedGroup[]> {
  if (deployment().mode === "demo")
    return (await import("./repository.mock")).getRelatedGroups(kind, id);
  return relationData(kind, id);
}
