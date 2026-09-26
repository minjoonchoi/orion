export type Deployment = {
  mode: "demo" | "api";
  environment: string;
  region: string;
  baseUrl: string | null;
  loginUrl: string | null;
  timeZone: string;
  timeoutMs: number;
  sessionCookie: string | null;
};
function trustedUrl(value: string, environment: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid API base URL");
  if (environment === "production" && url.protocol !== "https:")
    throw new Error("Production API requires HTTPS");
  return url.href.replace(/\/$/, "");
}
/** Runtime deployment configuration. Never accept a host or region from request input. */
export function resolveDeployment(
  env: Record<string, string | undefined>,
): Deployment {
  const mode =
    env.ORION_DATA_SOURCE ?? (env.NODE_ENV === "production" ? "api" : "demo");
  if (mode !== "api" && mode !== "demo")
    throw new Error("Invalid ORION_DATA_SOURCE");
  const environment =
    env.ORION_ENVIRONMENT ??
    (env.NODE_ENV === "production" ? "production" : "development");
  const region = env.ORION_REGION ?? "local";
  let selected: { baseUrl?: string; loginUrl?: string } = {};
  if (env.ORION_API_ENDPOINTS_JSON) {
    const map: unknown = JSON.parse(env.ORION_API_ENDPOINTS_JSON);
    if (!map || typeof map !== "object")
      throw new Error("Invalid endpoint map");
    const environments = map as Record<
      string,
      Record<string, { baseUrl?: string; loginUrl?: string }>
    >;
    selected = environments[environment]?.[region] ?? {};
  }
  const raw = env.ORION_API_BASE_URL ?? selected.baseUrl;
  const baseUrl = raw ? trustedUrl(raw, environment) : null;
  if (mode === "api" && !baseUrl)
    throw new Error(`Missing API endpoint for ${environment}/${region}`);
  const loginUrl = env.ORION_AUTH_LOGIN_URL ?? selected.loginUrl ?? null;
  if (loginUrl) {
    const u = new URL(loginUrl);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.hash ||
      (environment === "production" && u.protocol !== "https:")
    )
      throw new Error("Invalid login URL");
  }
  const timeZone = env.ORION_TIME_ZONE ?? "Asia/Seoul";
  new Intl.DateTimeFormat("en", { timeZone }).format();
  const timeoutMs = Number(env.ORION_API_TIMEOUT_MS ?? 10000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000)
    throw new Error("Invalid API timeout");
  const sessionCookie = env.ORION_SESSION_COOKIE ?? null;
  if (sessionCookie && !/^[A-Za-z0-9_-]+$/.test(sessionCookie))
    throw new Error("Invalid session cookie name");
  return {
    mode,
    environment,
    region,
    baseUrl,
    loginUrl,
    timeZone,
    timeoutMs,
    sessionCookie,
  };
}
