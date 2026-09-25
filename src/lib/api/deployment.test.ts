import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDeployment } from "./deployment.ts";
import { requestData, DataApiError } from "./transport.ts";
import { object, string, datetime } from "./schema.ts";
import { contracts } from "./contracts.ts";
const map = JSON.stringify({
  production: {
    kr: {
      baseUrl: "https://kr.example.test/v1",
      loginUrl: "https://kr.example.test/login",
    },
    us: {
      baseUrl: "https://us.example.test/v1",
      loginUrl: "https://us.example.test/login",
    },
  },
  staging: { kr: { baseUrl: "https://staging.example.test/v1" } },
});
test("selects endpoints at runtime by environment and region, explicit overrides win", () => {
  for (const [environment, region, url] of [
    ["production", "kr", "https://kr.example.test/v1"],
    ["production", "us", "https://us.example.test/v1"],
    ["staging", "kr", "https://staging.example.test/v1"],
  ])
    assert.equal(
      resolveDeployment({
        ORION_DATA_SOURCE: "api",
        ORION_ENVIRONMENT: environment,
        ORION_REGION: region,
        ORION_API_ENDPOINTS_JSON: map,
      }).baseUrl,
      url,
    );
  assert.equal(
    resolveDeployment({
      ORION_DATA_SOURCE: "api",
      ORION_API_ENDPOINTS_JSON: map,
      ORION_API_BASE_URL: "https://override.example.test",
    }).baseUrl,
    "https://override.example.test",
  );
});
test("production fails closed without endpoint; invalid hosts and settings rejected", () => {
  assert.throws(() => resolveDeployment({ NODE_ENV: "production" }));
  for (const url of [
    "http://unsafe.test",
    "https://user:secret@host.test",
    "https://host.test?key=secret",
    "file:///tmp",
  ])
    assert.throws(() =>
      resolveDeployment({
        ORION_DATA_SOURCE: "api",
        ORION_ENVIRONMENT: "production",
        ORION_API_BASE_URL: url,
      }),
    );
  assert.throws(() => resolveDeployment({ ORION_TIME_ZONE: "invalid/zone" }));
  assert.throws(() => resolveDeployment({ ORION_API_TIMEOUT_MS: "0" }));
  assert.equal(
    resolveDeployment({ ORION_DATA_SOURCE: "demo", NODE_ENV: "production" })
      .mode,
    "demo",
  );
});
test("schemas reject malformed payloads and project away unknown fields", () => {
  assert.deepEqual(
    object({ name: string }).parse({ name: "A", secret: "never serialize" }),
    { name: "A" },
  );
  assert.throws(() => contracts.users.list.parse({ id: "u" }));
  assert.throws(() => datetime.parse("yesterday"));
  assert.throws(() => datetime.parse("2026-01-01T00:00:00"));
  assert.equal(datetime.parse("2026-01-01T00:00:00Z"), "2026-01-01T00:00:00Z");
});
test("transport sends deployment and locale headers, forwards only configured cookie, does not cache or follow redirects", async (t) => {
  const config = resolveDeployment({
    ORION_DATA_SOURCE: "api",
    ORION_API_BASE_URL: "https://kr.example.test/v1",
    ORION_REGION: "kr",
    ORION_SESSION_COOKIE: "session",
  });
  t.mock.method(globalThis, "fetch", async (url: URL, init: RequestInit) => {
    assert.equal(url.href, "https://kr.example.test/v1/users");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("Accept-Language"), "en");
    assert.equal(headers.get("X-Orion-Region"), "kr");
    assert.equal(headers.get("Cookie"), "session=a%3Bb");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    return Response.json({ name: "API record", secret: "hidden" });
  });
  assert.deepEqual(
    await requestData(config, "users", object({ name: string }), {
      locale: "en",
      session: "a;b",
    }),
    { name: "API record" },
  );
  await assert.rejects(
    requestData(config, "https://outside.test", object({ name: string }), {
      locale: "en",
    }),
    DataApiError,
  );
});
test("HTTP failures and invalid responses never become demo data", async (t) => {
  const config = resolveDeployment({
    ORION_DATA_SOURCE: "api",
    ORION_API_BASE_URL: "https://api.example.test",
  });
  for (const status of [401, 403, 404, 500]) {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response("private server details", { status }),
    );
    await assert.rejects(
      requestData(config, "users", object({ name: string }), { locale: "ko" }),
      (e: unknown) =>
        e instanceof DataApiError &&
        e.status === status &&
        !e.message.includes("private"),
    );
  }
  t.mock.method(globalThis, "fetch", async () => Response.json({ name: 1 }));
  await assert.rejects(
    requestData(config, "users", object({ name: string }), { locale: "ko" }),
    (e: unknown) => e instanceof DataApiError && e.code === "INVALID_RESPONSE",
  );
  t.mock.method(globalThis, "fetch", async () => {
    throw Error("network");
  });
  await assert.rejects(
    requestData(config, "users", object({ name: string }), { locale: "ko" }),
    (e: unknown) =>
      e instanceof DataApiError && e.code === "NETWORK_OR_TIMEOUT",
  );
});
