import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApiClient } from "./client.ts";
test("client handles JSON, cookies, errors and empty responses", async (t) => {
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response('{"ok":true}'),
  );
  const request = createApiClient("https://api.example.com/v1");
  assert.deepEqual(await request("/users"), { ok: true });
  assert.equal(
    String(mock.mock.calls[0].arguments[0]),
    "https://api.example.com/v1/users",
  );
  assert.equal(mock.mock.calls[0].arguments[1]?.credentials, "include");
  assert.equal(mock.mock.calls[0].arguments[1]?.cache, "no-store");
  mock.mock.mockImplementation(async () => new Response(null, { status: 204 }));
  assert.equal(await request("users"), undefined);
  mock.mock.mockImplementation(
    async () => new Response("private server details", { status: 403 }),
  );
  await assert.rejects(
    request("users"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 403 &&
      !error.message.includes("private"),
  );
  await assert.rejects(request("https://evil.example/users"));
  await assert.rejects(request("../admin"));
});
