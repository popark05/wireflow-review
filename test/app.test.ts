import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app.js";

const validFlow = {
  applicationId: "demo-app",
  title: "Sign-in flow",
  nodes: [
    { nodeId: "home", type: "screen", title: "Home", screenId: "screen.home" },
    { nodeId: "login", type: "screen", title: "Login", screenId: "screen.login" }
  ],
  edges: [
    { edgeId: "home-login", fromNodeId: "home", toNodeId: "login", label: "Log in", trigger: "tap" }
  ]
};

test("imports and retrieves a valid wireflow", async () => {
  const app = buildApp();
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: validFlow });
  assert.equal(imported.statusCode, 201);
  const flow = imported.json();
  assert.equal(flow.version, 1);
  assert.equal(flow.reviewStatus, "draft");

  const retrieved = await app.inject({ method: "GET", url: `/v1/flows/${flow.flowId}` });
  assert.equal(retrieved.statusCode, 200);
  assert.equal(retrieved.json().edges.length, 1);
  await app.close();
});

test("rejects edges that reference unknown nodes", async () => {
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/v1/flows/import",
    payload: {
      ...validFlow,
      edges: [{ edgeId: "broken", fromNodeId: "home", toNodeId: "missing" }]
    }
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error, "invalid_wireflow");
  await app.close();
});

test("rejects a graph without a screen node", async () => {
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/v1/flows/import",
    payload: {
      applicationId: "demo-app",
      title: "Invalid flow",
      nodes: [{ nodeId: "decision", type: "decision", title: "Continue?" }],
      edges: []
    }
  });
  assert.equal(response.statusCode, 422);
  await app.close();
});
