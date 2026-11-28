import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { FlowModelV1 } from "../src/domain/wireflow.js";
import { buildApp } from "../src/server/app.js";

const schema = JSON.parse(await readFile(new URL("../contracts/flow-model.v1.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
const validateFlowModel = ajv.compile(schema);

const LOGIN_SCREEN_ID = "6f1c1f8e-3c55-4c2a-9d0e-2f0b8f7f1a01";
const TRANSITION_ID = "0b6f4d0c-8f4e-4a54-9a39-7d1f7a3e5c02";

const checkoutFlow = {
  applicationId: "demo-app",
  title: "Checkout",
  description: "Cart to payment, with failure retry",
  nodes: [
    { nodeId: "cart", type: "screen", title: "Cart", metadata: { note: "internal only" } },
    {
      nodeId: "payment",
      type: "screen",
      title: "Payment",
      discoveryRef: { sourceSystem: "reverse-screen", screenId: LOGIN_SCREEN_ID }
    },
    { nodeId: "payment-error", type: "screen", title: "Payment failed", origin: "ai_suggestion" },
    { nodeId: "saved-card?", type: "decision", title: "Use saved card?", origin: "open_question" }
  ],
  edges: [
    {
      edgeId: "cart-payment",
      fromNodeId: "cart",
      toNodeId: "payment",
      trigger: "tap checkout",
      discoveryRef: { sourceSystem: "reverse-screen", transitionId: TRANSITION_ID }
    },
    { edgeId: "payment-fail", fromNodeId: "payment", toNodeId: "payment-error", kind: "failure", origin: "ai_suggestion" },
    { edgeId: "retry", fromNodeId: "payment-error", toNodeId: "payment", kind: "retry" }
  ]
};

async function importAndApprove(app: ReturnType<typeof buildApp>) {
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: checkoutFlow });
  assert.equal(imported.statusCode, 201);
  const flowId: string = imported.json().flowId;
  await app.inject({ method: "POST", url: `/v1/flows/${flowId}/submissions` });
  const review = await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/reviews`,
    payload: { reviewerId: "owner", decision: "approved" }
  });
  return { flowId, reviewId: review.json().reviewId as string };
}

test("approved flow exports a document that conforms to flow-model v1", async () => {
  const app = buildApp();
  const { flowId, reviewId } = await importAndApprove(app);

  const exported = await app.inject({ method: "GET", url: `/v1/flows/${flowId}/export` });
  assert.equal(exported.statusCode, 200);
  const model = exported.json<FlowModelV1>();

  assert.ok(validateFlowModel(model), JSON.stringify(validateFlowModel.errors, null, 2));
  assert.equal(model.contractVersion, "1.0");
  assert.equal(model.sourceSystem, "wireflow-review");
  assert.equal(model.flowVersion, 1);
  assert.equal(model.approval.reviewId, reviewId);
  assert.equal(model.approval.reviewerId, "owner");

  const cart = model.nodes.find((node) => node.nodeId === "cart");
  assert.ok(cart);
  assert.equal(cart.origin, "product_requirement", "origin defaults to product_requirement");
  assert.equal("metadata" in cart, false, "internal metadata is not published");

  const primary = model.edges.find((edge) => edge.edgeId === "cart-payment");
  assert.ok(primary);
  assert.equal(primary.kind, "primary", "kind defaults to primary");
  assert.equal(primary.discoveryRef?.transitionId, TRANSITION_ID);
  await app.close();
});

test("flows that are not approved cannot be exported", async () => {
  const app = buildApp();
  const imported = await app.inject({ method: "POST", url: "/v1/flows/import", payload: checkoutFlow });
  const flowId: string = imported.json().flowId;

  const draft = await app.inject({ method: "GET", url: `/v1/flows/${flowId}/export` });
  assert.equal(draft.statusCode, 409);
  assert.equal(draft.json().error, "flow_not_approved");

  await app.inject({ method: "POST", url: `/v1/flows/${flowId}/submissions` });
  await app.inject({
    method: "POST",
    url: `/v1/flows/${flowId}/reviews`,
    payload: { reviewerId: "owner", decision: "changes_requested", comment: "missing empty cart path" }
  });
  const rejected = await app.inject({ method: "GET", url: `/v1/flows/${flowId}/export` });
  assert.equal(rejected.statusCode, 409);

  const missing = await app.inject({ method: "GET", url: "/v1/flows/00000000-0000-4000-8000-000000000000/export" });
  assert.equal(missing.statusCode, 404);
  await app.close();
});

test("import rejects Reverse Screen references that are not UUIDs or carry no IDs", async () => {
  const app = buildApp();
  const badId = await app.inject({
    method: "POST",
    url: "/v1/flows/import",
    payload: {
      ...checkoutFlow,
      nodes: [{ nodeId: "cart", type: "screen", title: "Cart", discoveryRef: { sourceSystem: "reverse-screen", screenId: "screen.cart" } }],
      edges: []
    }
  });
  assert.equal(badId.statusCode, 400);

  const empty = await app.inject({
    method: "POST",
    url: "/v1/flows/import",
    payload: {
      ...checkoutFlow,
      nodes: [{ nodeId: "cart", type: "screen", title: "Cart", discoveryRef: { sourceSystem: "reverse-screen" } }],
      edges: []
    }
  });
  assert.equal(empty.statusCode, 400);
  await app.close();
});
