import { redirect } from "next/navigation";
import "server-only";
import { cookies } from "next/headers";
import { resolveDeployment } from "./deployment";
import { contracts, relatedGroups } from "./contracts";
import { object, array, nullable, string, type Schema } from "./schema";
import { requestData, DataApiError } from "./transport";
import { getLocale } from "@/i18n/server";
export const deployment = () => resolveDeployment(process.env);
async function request<T>(path: string, schema: Schema<T>) {
  const config = deployment();
  const jar = await cookies();
  try {
    return await requestData(config, path, schema, {
      locale: await getLocale(),
      session: config.sessionCookie
        ? jar.get(config.sessionCookie)?.value
        : undefined,
    });
  } catch (error) {
    if (error instanceof DataApiError && error.status === 403)
      redirect("/forbidden");
    if (error instanceof DataApiError && error.status === 401)
      redirect("/login");
    throw error;
  }
}
type Resource = keyof typeof contracts;
export async function listData<T>(resource: Resource): Promise<T[]> {
  const result: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const schema = object({
      data: array(contracts[resource].list as Schema<T>),
      pagination: object({ nextCursor: nullable(string) }),
    });
    const response: { data: T[]; pagination: { nextCursor: string | null } } =
      await request(
        `${resource}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        schema,
      );
    result.push(...response.data);
    cursor = response.pagination.nextCursor;
    if (!cursor) return result;
    if (seen.has(cursor)) throw new DataApiError(200, "REPEATED_CURSOR");
    seen.add(cursor);
  }
  throw new DataApiError(200, "PAGE_LIMIT_EXCEEDED");
}
export async function detailData<T>(
  resource: Resource,
  id: string,
): Promise<T | null> {
  try {
    return (
      await request(
        `${resource}/${encodeURIComponent(id)}`,
        object({ data: contracts[resource].detail as Schema<T> }),
      )
    ).data;
  } catch (error) {
    if (error instanceof DataApiError && error.status === 404) return null;
    throw error;
  }
}
export async function relationData(kind: string, id: string) {
  const groups = (
    await request(
      `${kind}/${encodeURIComponent(id)}/relationships`,
      object({ data: relatedGroups }),
    )
  ).data;
  for (const group of groups)
    for (const row of group.rows) {
      if (
        !/^\/(users|organizations|roles|policies|services|service-endpoints|workspaces|pages|api-keys|approvals|approval-templates|service-accounts)\/[A-Za-z0-9_-]+$/.test(
          row.href,
        )
      )
        throw new DataApiError(200, "INVALID_RELATION_LINK");
    }
  return groups;
}
