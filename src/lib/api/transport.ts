import type { Deployment } from "./deployment";
import type { Schema } from "./schema";
export class DataApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(`Data API: ${code} (${status})`);
    this.name = "DataApiError";
    this.status = status;
    this.code = code;
  }
}
export async function requestData<T>(
  config: Deployment,
  path: string,
  schema: Schema<T>,
  options: {
    locale: string;
    session?: string;
    method?: "POST";
    body?: unknown;
  },
): Promise<T> {
  if (!config.baseUrl) throw new DataApiError(0, "CONFIGURATION");
  const base = new URL(config.baseUrl.replace(/\/$/, "") + "/");
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
    throw new DataApiError(0, "INVALID_PATH");
  const headers = new Headers({
    Accept: "application/json",
    "Accept-Language": options.locale,
    "X-Orion-Region": config.region,
  });
  if (options.session && config.sessionCookie)
    headers.set(
      "Cookie",
      `${config.sessionCookie}=${encodeURIComponent(options.session)}`,
    );
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      method: options.method ?? "GET",
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    throw new DataApiError(0, "NETWORK_OR_TIMEOUT");
  }
  if (!response.ok) throw new DataApiError(response.status, "HTTP_ERROR");
  try {
    return schema.parse(
      response.status === 204 ? undefined : await response.json(),
    );
  } catch {
    throw new DataApiError(response.status, "INVALID_RESPONSE");
  }
}
