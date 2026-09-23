import { createServer } from "node:http";
import { spawn } from "node:child_process";
const user = (region, locale, id = "remote-user") => ({
  id,
  name: `Live ${region} ${locale}`,
  email: "api@example.test",
  employeeNumber: "API-1",
  title: "API record",
  status: "active",
  createdAt: "2026-09-23T00:00:00Z",
  lastSignedInAt: null,
});
const handler = (expectedRegion) => (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const region = request.headers["x-orion-region"];
  const locale = request.headers["accept-language"];
  response.setHeader("Content-Type", "application/json");
  const send = (data, status = 200) => {
    response.statusCode = status;
    response.end(JSON.stringify(data));
  };
  if (region !== expectedRegion) return send({}, 500);
  if (parts[0] !== "v1") return send({}, 404);
  if (parts[1] === "users" && parts.length === 2) {
    if (url.searchParams.get("cursor") === "second")
      return send({
        data: [
          {
            ...user(region, locale, "remote-user-2"),
            organizations: [],
            roleCount: 0,
          },
        ],
        pagination: { nextCursor: null },
      });
    return send({
      data: [
        {
          ...user(region, locale),
          name:
            request.headers.cookie === "orion_session=valid"
              ? "Authenticated API user"
              : `Live ${region} ${locale}`,
          organizations: [],
          roleCount: 0,
        },
      ],
      pagination: { nextCursor: "second" },
    });
  }
  if (parts.length === 2)
    return send({ data: [], pagination: { nextCursor: null } });
  if (parts[2] === "missing") return send({}, 404);
  if (parts[2] === "denied") return send({ private: "do not expose" }, 403);
  if (parts[2] === "broken") return send({ data: { wrong: "shape" } });
  if (parts[3] === "relationships")
    return send({
      data: [
        {
          title: locale === "en" ? "Assigned users" : "연결 사용자",
          rows: [
            {
              id: "remote-user-2",
              name: "Related API user",
              href: "/users/remote-user-2",
            },
          ],
        },
      ],
    });
  if (parts[1] === "users")
    return send({
      data: {
        user: user(region, locale, parts[2]),
        organizations: [],
        roles: [],
      },
    });
  return send({}, 404);
};
const api = createServer(handler("kr"));
const usApi = createServer(handler("us"));
await Promise.all([
  new Promise((resolve) => api.listen(3209, "127.0.0.1", resolve)),
  new Promise((resolve) => usApi.listen(3210, "127.0.0.1", resolve)),
]);
const endpointMap = JSON.stringify({
  staging: {
    kr: {
      baseUrl: "http://127.0.0.1:3209/v1",
      loginUrl: "http://127.0.0.1:3209/auth/kr",
    },
    us: {
      baseUrl: "http://127.0.0.1:3210/v1",
      loginUrl: "http://127.0.0.1:3210/auth/us",
    },
  },
});
const baseEnv = { ...process.env };
delete baseEnv.ORION_API_BASE_URL;
delete baseEnv.ORION_AUTH_LOGIN_URL;
const children = ["kr", "us"].map((region, index) =>
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(3200 + index),
    ],
    {
      stdio: "inherit",
      env: {
        ...baseEnv,
        ORION_DATA_SOURCE: "api",
        ORION_ENVIRONMENT: "staging",
        ORION_REGION: region,
        ORION_API_ENDPOINTS_JSON: endpointMap,
        ORION_SESSION_COOKIE: "orion_session",
        ORION_TIME_ZONE: "UTC",
      },
    },
  ),
);
// Unset explicit URL overrides rather than allow a developer's local environment to affect tests.
for (const child of children)
  child.on("exit", (code) => {
    if (code) process.exitCode = code;
  });
function shutdown() {
  for (const child of children) child.kill("SIGTERM");
  api.close();
  usApi.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
