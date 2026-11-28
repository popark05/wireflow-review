import Fastify, { type FastifyInstance } from "fastify";
import { validateWireflow, WireflowStore, type ReviewDecision, type WireflowInput } from "../domain/wireflow.js";

const originSchema = { type: "string", enum: ["product_requirement", "ai_suggestion", "open_question"] } as const;

const reverseScreenRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sourceSystem"],
  minProperties: 2,
  properties: {
    sourceSystem: { const: "reverse-screen" },
    screenId: { type: "string", format: "uuid" },
    stateId: { type: "string", format: "uuid" },
    transitionId: { type: "string", format: "uuid" },
    sessionId: { type: "string", format: "uuid" }
  }
} as const;

const importSchema = {
  type: "object",
  additionalProperties: false,
  required: ["applicationId", "title", "nodes", "edges"],
  properties: {
    applicationId: { type: "string", minLength: 1, maxLength: 200 },
    title: { type: "string", minLength: 1, maxLength: 240 },
    description: { type: "string", maxLength: 4000 },
    nodes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nodeId", "type", "title"],
        properties: {
          nodeId: { type: "string", minLength: 1, maxLength: 200 },
          type: { type: "string", enum: ["screen", "decision", "external"] },
          title: { type: "string", minLength: 1, maxLength: 240 },
          origin: originSchema,
          discoveryRef: reverseScreenRefSchema,
          metadata: { type: "object" }
        }
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["edgeId", "fromNodeId", "toNodeId"],
        properties: {
          edgeId: { type: "string", minLength: 1, maxLength: 200 },
          fromNodeId: { type: "string", minLength: 1, maxLength: 200 },
          toNodeId: { type: "string", minLength: 1, maxLength: 200 },
          kind: { type: "string", enum: ["primary", "back", "cancel", "retry", "empty", "failure"] },
          label: { type: "string", maxLength: 240 },
          trigger: { type: "string", maxLength: 240 },
          origin: originSchema,
          discoveryRef: reverseScreenRefSchema
        }
      }
    }
  }
} as const;

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reviewerId", "decision"],
  properties: {
    reviewerId: { type: "string", minLength: 1, maxLength: 200 },
    decision: { type: "string", enum: ["approved", "changes_requested"] },
    comment: { type: "string", maxLength: 4000 }
  }
} as const;

export function buildApp(store = new WireflowStore()): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: "wireflow-review" }));

  app.post<{ Body: WireflowInput }>("/v1/flows/import", { schema: { body: importSchema } }, async (request, reply) => {
    const issues = validateWireflow(request.body);
    if (issues.length) return reply.code(422).send({ error: "invalid_wireflow", issues });
    return reply.code(201).send(store.import(request.body));
  });

  app.get<{ Params: { flowId: string } }>("/v1/flows/:flowId", async (request, reply) => {
    const flow = store.get(request.params.flowId);
    if (!flow) return reply.code(404).send({ error: "flow_not_found" });
    return flow;
  });

  app.post<{ Params: { flowId: string } }>("/v1/flows/:flowId/submissions", async (request, reply) => {
    const flow = store.submit(request.params.flowId);
    if (!flow) return reply.code(409).send({ error: "flow_cannot_be_submitted" });
    return flow;
  });

  app.post<{ Params: { flowId: string }; Body: { reviewerId: string; decision: ReviewDecision; comment?: string } }>(
    "/v1/flows/:flowId/reviews",
    { schema: { body: reviewSchema } },
    async (request, reply) => {
      const { reviewerId, decision, comment } = request.body;
      const review = store.review(request.params.flowId, reviewerId, decision, comment);
      if (!review) return reply.code(409).send({ error: "flow_not_in_review" });
      return reply.code(201).send(review);
    }
  );

  // Publishes contracts/flow-model.v1.schema.json. Only approved flows are exportable.
  app.get<{ Params: { flowId: string } }>("/v1/flows/:flowId/export", async (request, reply) => {
    if (!store.get(request.params.flowId)) return reply.code(404).send({ error: "flow_not_found" });
    const model = store.export(request.params.flowId);
    if (!model) return reply.code(409).send({ error: "flow_not_approved" });
    return model;
  });

  return app;
}
