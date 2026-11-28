import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app.js";

const validFlow = {
  applicationId: "demo-app",
  title: "Sign-in flow",
  nodes: [
    { nodeId: "home", type: "screen", title: "Home" },
    { nodeId: "login", type: "screen", title: "Login" }
  ],
  edges: [
    { edgeId: "home-login", fromNodeId: "home", toNodeId: "login", label: "Log in", trigger: "tap" }
  ]
};

test("imports and retrieves a valid wireflow with an initial immutable revision", async () => {
  const app = buildApp();
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: validFlow });
  assert.equal(imported.statusCode, 201);
  const flow = imported.json();
  assert.equal(flow.version, 1);
  assert.equal(flow.reviewStatus, "draft");

  const retrieved = await app.inject({ method: "GET", url: `/v1/flows/${flow.flowId}` });
  assert.equal(retrieved.statusCode, 200);
  assert.equal(retrieved.json().edges.length, 1);

  const revisions = await app.inject({ method: "GET", url: `/v1/flows/${flow.flowId}/revisions` });
  assert.equal(revisions.statusCode, 200);
  assert.equal(revisions.json().length, 1);
  assert.equal(revisions.json()[0].version, 1);
  await app.close();
});

test("creates sequential immutable revisions and rejects stale expected versions", async () => {
  const app = buildApp();
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: validFlow });
  const flowId = imported.json().flowId;

  const created = await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/revisions`,
    payload: {
      expectedVersion: 1,
      title: "Updated sign-in flow",
      nodes: [
        { nodeId: "home", type: "screen", title: "Home" },
        { nodeId: "login", type: "screen", title: "Login" },
        { nodeId: "mfa", type: "screen", title: "MFA" }
      ],
      edges: [
        { edgeId: "home-login", fromNodeId: "home", toNodeId: "login" },
        { edgeId: "login-mfa", fromNodeId: "login", toNodeId: "mfa" }
      ]
    }
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().version, 2);

  const stale = await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/revisions`,
    payload: { expectedVersion: 1, title: "Stale write", nodes: validFlow.nodes, edges: validFlow.edges }
  });
  assert.equal(stale.statusCode, 409);

  const first = await app.inject({ method: "GET", url: `/v1/flows/${flowId}/revisions/1` });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().document.title, "Sign-in flow");
  assert.equal(first.json().document.nodes.length, 2);

  const current = await app.inject({ method: "GET", url: `/v1/flows/${flowId}` });
  assert.equal(current.json().version, 2);
  assert.equal(current.json().title, "Updated sign-in flow");
  assert.equal(current.json().nodes.length, 3);

  const revisions = await app.inject({ method: "GET", url: `/v1/flows/${flowId}/revisions` });
  assert.deepEqual(revisions.json().map((revision: { version: number }) => revision.version), [1, 2]);
  await app.close();
});

test("concurrent revision writes with the same expected version cannot both win", async () => {
  const app = buildApp();
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: validFlow });
  const flowId = imported.json().flowId;
  const payload = {
    expectedVersion: 1, title: "Concurrent revision",
    nodes: validFlow.nodes, edges: validFlow.edges
  };
  const results = await Promise.all([
    app.inject({ method: "POST", url: `/v1/flows/${flowId}/revisions`, payload }),
    app.inject({ method: "POST", url: `/v1/flows/${flowId}/revisions`, payload })
  ]);
  assert.deepEqual(results.map((result) => result.statusCode).sort(), [201, 409]);
  const current = await app.inject({ method: "GET", url: `/v1/flows/${flowId}` });
  assert.equal(current.json().version, 2);
  await app.close();
});

test("does not allow revision creation while a flow is in review", async () => {
  const app = buildApp();
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: validFlow });
  const flowId = imported.json().flowId;
  await app.inject({ method: "POST", url: `/v1/flows/${flowId}/submissions` });

  const response = await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/revisions`,
    payload: { expectedVersion: 1, title: "While reviewing", nodes: validFlow.nodes, edges: validFlow.edges }
  });
  assert.equal(response.statusCode, 409);
  await app.close();
});

test("rejects edges that reference unknown nodes", async () => {
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/v1/flows/import",
    payload: { ...validFlow, edges: [{ edgeId: "broken", fromNodeId: "home", toNodeId: "missing" }] }
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
      applicationId: "demo-app", title: "Invalid flow",
      nodes: [{ nodeId: "decision", type: "decision", title: "Continue?" }], edges: []
    }
  });
  assert.equal(response.statusCode, 422);
  await app.close();
});

test("rejects unknown fields instead of silently dropping them", async () => {
  const app = buildApp();
  const typo = await app.inject({
    method: "POST", url: "/v1/flows/import",
    payload: { ...validFlow, nodes: [{ nodeId: "home", type: "screen", title: "Home", screenID: "typo" }], edges: [] }
  });
  assert.equal(typo.statusCode, 400);
  const extraTopLevel = await app.inject({ method: "POST", url: "/v1/flows/import", payload: { ...validFlow, tasks: [] } });
  assert.equal(extraTopLevel.statusCode, 400);
  await app.close();
});
