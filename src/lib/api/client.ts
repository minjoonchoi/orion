export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`API request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
  }
}
/** Browser client. Backend must enforce authentication, authorization and CSRF protection. */
export function createApiClient(baseUrl: string) {
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (!["http:", "https:"].includes(base.protocol))
    throw new Error("API URL must use HTTP(S)");
  return async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    const url = new URL(path.replace(/^\/+/, ""), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      throw new Error("API path must stay within the configured base URL");
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    const response = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new ApiError(response.status);
    if (response.status === 204 || response.status === 205) return undefined;
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  };
}
export function getApiClient() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  return createApiClient(baseUrl);
}
