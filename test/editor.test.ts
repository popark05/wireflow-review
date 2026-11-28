import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app.js";

test("serves the visual Wireflow editor with graph and persistence controls", async () => {
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/editor" });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /^text\/html; charset=utf-8/);
  assert.match(response.body, /Wireflow Studio/);
  assert.match(response.body, /data-add="screen"/);
  assert.match(response.body, /data-add="decision"/);
  assert.match(response.body, /data-add="external"/);
  assert.match(response.body, /\/v1\/flows\/import/);
  assert.match(response.body, /\/revisions/);
  assert.match(response.body, /svg\.setAttribute\('viewBox'/);

  await app.close();
});
