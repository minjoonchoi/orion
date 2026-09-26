import { seed as workflowSeed } from "../../src/features/approval-workflow/demo.ts";
import {
  apply as workflowApply,
  publicState,
} from "../../src/features/approval-workflow/model.ts";
import { createHash } from "node:crypto";
const workflowSessions = new Map();
import { readFileSync } from "node:fs";
import {
  parseSources,
  makePlan,
} from "../../src/features/definitions/model.ts";
const definitionSessions = new Map();
import { createServer } from "node:http";
import { spawn } from "node:child_process";
const user = (region, locale, id = "remote-user") => ({
  id,
  name: `Live ${region} ${locale}`,
  email: "api@example.test",
  status: "employed",
});
const authorizationGraphs = new Map();
function authGraph(region) {
  if (!authorizationGraphs.has(region))
    authorizationGraphs.set(region, {
      revision: 0,
      users: [{ id: "remote-user", name: "Remote user" }],
      organizations: [],
      roles: [
        {
          id: "remote-role",
          name: "Remote role",
          description: "API role",
          userIds: [],
          organizationIds: [],
          bindings: [],
        },
      ],
      policies: [],
      resources: [],
    });
  return authorizationGraphs.get(region);
}
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
  if (parts[1] === "approval-workflow") {
    if (request.headers.cookie === "orion_session=forbidden")
      return send({}, 403);
    const key = region + ":" + (request.headers.cookie ?? "");
    const state = workflowSessions.get(key) ?? workflowSeed();
    if (request.method === "GET") return send(publicState(state));
    if (request.method !== "POST" || parts[2] !== "commands")
      return send({}, 405);
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        const { command, expectedRevision } = JSON.parse(body);
        const hash =
          command.kind === "execute" && command.secretText
            ? createHash("sha256").update(command.secretText).digest("hex")
            : "";
        const updated = workflowApply(
          state,
          command,
          expectedRevision,
          new Date().toISOString(),
          hash,
        );
        workflowSessions.set(key, updated);
        send({ status: "ok", ...(hash ? { hash } : {}) });
      } catch {
        send({}, 409);
      }
    });
    return;
  }
  if (parts[1] === "auth" && parts[2] === "logout") {
    if (request.method !== "POST") return send({}, 405);
    if (request.headers.cookie === "orion_session=logout-fail")
      return send({}, 500);
    response.statusCode = 204;
    response.end();
    return;
  }
  if (parts[1] === "definitions") {
    if (request.headers.cookie === "orion_session=forbidden")
      return send({}, 403);
    if (request.headers.cookie === "orion_session=malformed")
      return send({ data: { applied: [{ key: "actions:unsafe" }] } });
    const graph = authGraph(region);
    const base = {
      revision: graph.revision,
      sourceRevision: "remote-source",
      environment: "staging",
      region,
      applied: [],
      desired: [],
      history: [],
      graph,
    };
    if (request.headers.cookie !== "orion_session=definitions")
      return send({ data: base });
    if (!definitionSessions.has(region)) {
      const desired = parseSources([
        readFileSync("config/definitions/platform.yaml", "utf8"),
      ]);
      const applied = structuredClone(desired);
      const item = applied.find(
        (e) => e.key === "service-endpoints:identity-api/detail",
      );
      item.name = "Remote endpoint";
      item.definition.name = item.name;
      definitionSessions.set(region, { ...base, applied, desired });
    }
    const state = definitionSessions.get(region);
    if (parts[2] === "status") return send({ data: state });
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const payload = JSON.parse(body);
      if (parts[2] === "previews")
        return send({
          data: {
            token: "remote-preview",
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            revision: state.revision,
            sourceRevision: state.sourceRevision,
            plan: makePlan(state, payload.selected),
          },
        });
      if (parts[2] === "applications") {
        if (payload.token !== "remote-preview") return send({}, 409);
        state.applied = structuredClone(state.desired);
        state.revision++;
        state.graph = { ...state.graph, revision: state.revision };
        return send({ data: state });
      }
      return send({}, 404);
    });
    return;
  }
  if (parts[1] === "authorization") {
    if (request.headers.cookie === "orion_session=forbidden")
      return send({}, 403);
    if (parts[2] === "graph") return send({ data: authGraph(region) });
    if (parts[2] === "changes" && request.method === "POST") {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const payload = JSON.parse(body);
        const graph = authGraph(region);
        if (
          payload.revision !== graph.revision ||
          request.headers.cookie === "orion_session=conflict"
        )
          return send({}, 409);
        if (
          payload.change.type !== "subjectRoles" ||
          payload.change.id !== "remote-user"
        )
          return send({}, 400);
        graph.roles[0].userIds = payload.change.roleIds.includes("remote-role")
          ? ["remote-user"]
          : [];
        graph.revision++;
        return send({ data: graph });
      });
      return;
    }
  }

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
          title: locale === "en" ? "Assigned users" : "사용자",
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
