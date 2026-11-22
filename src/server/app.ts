import Fastify, { type FastifyInstance } from "fastify";
import { validateWireflow, WireflowStore, type WireflowInput } from "../domain/wireflow.js";

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
          screenId: { type: "string" },
          stateId: { type: "string" },
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
          label: { type: "string", maxLength: 240 },
          trigger: { type: "string", maxLength: 240 }
        }
      }
    }
  }
} as const;

export function buildApp(store = new WireflowStore()): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok", service: "wireflow-review" }));

  app.post<{ Body: WireflowInput }>(
    "/v1/flows/import",
    { schema: { body: importSchema } },
    async (request, reply) => {
      const issues = validateWireflow(request.body);
      if (issues.length > 0) return reply.code(422).send({ error: "invalid_wireflow", issues });
      return reply.code(201).send(store.import(request.body));
    }
  );

  app.get<{ Params: { flowId: string } }>("/v1/flows/:flowId", async (request, reply) => {
    const flow = store.get(request.params.flowId);
    if (!flow) return reply.code(404).send({ error: "flow_not_found" });
    return flow;
  });

  return app;
}
