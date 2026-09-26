import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLoginUrl } from "./login-url.ts";
test("accepts absolute backend URLs and preserves deployment query parameters", () => {
  assert.equal(
    resolveLoginUrl(" https://orion.example.test/auth/login?provider=okta "),
    "https://orion.example.test/auth/login?provider=okta",
  );
  assert.equal(
    resolveLoginUrl("http://localhost:8080/auth/login"),
    "http://localhost:8080/auth/login",
  );
});
test("missing or unsafe deployment URLs fail closed", () => {
  for (const value of [
    undefined,
    "",
    " ",
    "/login",
    "not a url",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:secret@example.test/login",
    "https://example.test/login#token",
  ])
    assert.equal(resolveLoginUrl(value), null);
});
