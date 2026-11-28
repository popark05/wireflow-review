import assert from "node:assert/strict";
import test from "node:test";
import { WireflowStore, type WireflowRepository } from "../src/domain/wireflow.js";
import { buildApp } from "../src/server/app.js";

test("API awaits asynchronous wireflow repository operations", async () => {
  const memory = new WireflowStore();
  const repository: WireflowRepository = {
    async import(input) { return memory.import(input); },
    async get(id) { return memory.get(id); },
    async submit(id) { return memory.submit(id); },
    async review(id, reviewerId, decision, comment) {
      return memory.review(id, reviewerId, decision, comment);
    }
  };
  const app = buildApp(repository);
  const imported = await app.inject({
    method: "POST",
    url: "/v1/flows/import",
    payload: {
      applicationId: "demo-app",
      title: "Async repository flow",
      nodes: [{ nodeId: "home", type: "screen", title: "Home" }],
      edges: []
    }
  });
  assert.equal(imported.statusCode, 201);
  const flowId = imported.json().flowId;

  const submitted = await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/submissions`
  });
  assert.equal(submitted.statusCode, 200);
  assert.equal(submitted.json().reviewStatus, "in_review");

  const reviewed = await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/reviews`,
    payload: { reviewerId: "reviewer", decision: "approved" }
  });
  assert.equal(reviewed.statusCode, 201);

  const fetched = await app.inject({ method: "GET", url: `/v1/flows/${flowId}` });
  assert.equal(fetched.json().reviewStatus, "approved");
  await app.close();
});
