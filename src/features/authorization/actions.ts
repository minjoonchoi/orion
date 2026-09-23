"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { deployment } from "@/lib/api/server";
import { requestData, DataApiError } from "@/lib/api/transport";
import { getLocale } from "@/i18n/server";
import { object } from "@/lib/api/schema";
import { graphSchema, parseChange, applyChange, type Graph } from "./model";
import { existingGraph, initialGraph, saveDemoGraph } from "./demo";
export type Result =
  { graph: Graph; error?: never } | { error: string; graph?: never };
async function remote(body?: unknown) {
  const config = deployment();
  return (
    await requestData(
      config,
      body === undefined ? "authorization/graph" : "authorization/changes",
      object({ data: graphSchema }),
      {
        locale: await getLocale(),
        session: config.sessionCookie
          ? (await cookies()).get(config.sessionCookie)?.value
          : undefined,
        ...(body === undefined ? {} : { method: "POST" as const, body }),
      },
    )
  ).data;
}
function code(error: unknown) {
  if (error instanceof DataApiError)
    return error.status === 403
      ? "FORBIDDEN"
      : error.status === 401
        ? "UNAUTHENTICATED"
        : error.status === 409
          ? "CONFLICT"
          : "REQUEST_FAILED";
  return error instanceof Error && error.message === "CONFLICT"
    ? "CONFLICT"
    : "INVALID_CHANGE";
}
export async function loadAuthorization(): Promise<Result> {
  try {
    if (deployment().mode === "api") return { graph: await remote() };
    let graph = await existingGraph();
    if (!graph) {
      graph = await initialGraph();
      await saveDemoGraph(graph);
    }
    return { graph };
  } catch (error) {
    return { error: code(error) };
  }
}
export async function changeAuthorization(
  revision: number,
  input: unknown,
): Promise<Result> {
  try {
    if (!Number.isSafeInteger(revision) || revision < 0) throw Error();
    const change = parseChange(input);
    if (deployment().mode === "api") {
      const graph = await remote({ revision, change });
      revalidatePath("/", "layout");
      return { graph };
    }
    const current = await existingGraph();
    if (!current || current.revision !== revision) return { error: "CONFLICT" };
    const graph = applyChange(current, change);
    await saveDemoGraph(graph, revision);
    revalidatePath("/", "layout");
    return { graph };
  } catch (error) {
    return { error: code(error) };
  }
}
