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

test("editor revision saves match the strict revision schema", async () => {
  const app = buildApp();
  const imported = await app.inject({
    method: "POST", url: "/v1/flows/import",
    payload: { applicationId: "demo-app", title: "Editor flow", nodes: [{ nodeId: "home", type: "screen", title: "Home" }], edges: [] }
  });
  const flowId = imported.json().flowId;
  const node = { nodeId: "home", type: "screen", title: "Home", metadata: { editorX: 140, editorY: 140 } };
  // The revision API keeps the application fixed, so a body carrying applicationId is rejected.
  const withApplication = await app.inject({
    method: "POST", url: `/v1/flows/${flowId}/revisions`,
    payload: { applicationId: "demo-app", title: "Editor flow", nodes: [node], edges: [], expectedVersion: 1 }
  });
  assert.equal(withApplication.statusCode, 400);
  const editorShaped = await app.inject({
    method: "POST", url: `/v1/flows/${flowId}/revisions`,
    payload: { title: "Editor flow", nodes: [node], edges: [], expectedVersion: 1 }
  });
  assert.equal(editorShaped.statusCode, 201);
  const page = await app.inject({ method: "GET", url: "/editor" });
  assert.match(page.body, /applicationId:_applicationId,\.\.\.revisionBody/, "the editor strips applicationId from revision saves");
  assert.doesNotMatch(page.body, /'Screen ID','screenId'/, "free-form screen IDs are no longer editable");
  await app.close();
});
