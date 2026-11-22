import { randomUUID } from "node:crypto";

export type FlowNodeType = "screen" | "decision" | "external";
export type ReviewStatus = "draft" | "in_review" | "approved" | "changes_requested";

export interface FlowNode {
  nodeId: string;
  type: FlowNodeType;
  title: string;
  screenId?: string;
  stateId?: string;
  metadata?: Record<string, unknown>;
}

export interface FlowEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  trigger?: string;
}

export interface WireflowDocument {
  flowId: string;
  version: number;
  applicationId: string;
  title: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface WireflowInput {
  applicationId: string;
  title: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type ValidationIssue = { path: string; message: string };

export function validateWireflow(input: WireflowInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.applicationId.trim()) issues.push({ path: "applicationId", message: "applicationId is required" });
  if (!input.title.trim()) issues.push({ path: "title", message: "title is required" });
  if (input.nodes.length === 0) issues.push({ path: "nodes", message: "at least one node is required" });

  const ids = new Set<string>();
  for (const [index, node] of input.nodes.entries()) {
    if (ids.has(node.nodeId)) issues.push({ path: `nodes[${index}].nodeId`, message: "nodeId must be unique" });
    ids.add(node.nodeId);
  }
  const screenNodes = input.nodes.filter((node) => node.type === "screen");
  if (screenNodes.length === 0) issues.push({ path: "nodes", message: "at least one screen node is required" });

  const edgeIds = new Set<string>();
  for (const [index, edge] of input.edges.entries()) {
    if (edgeIds.has(edge.edgeId)) issues.push({ path: `edges[${index}].edgeId`, message: "edgeId must be unique" });
    edgeIds.add(edge.edgeId);
    if (!ids.has(edge.fromNodeId)) issues.push({ path: `edges[${index}].fromNodeId`, message: "source node does not exist" });
    if (!ids.has(edge.toNodeId)) issues.push({ path: `edges[${index}].toNodeId`, message: "target node does not exist" });
  }
  return issues;
}

export class WireflowStore {
  private readonly flows = new Map<string, WireflowDocument>();

  import(input: WireflowInput): WireflowDocument {
    const flow: WireflowDocument = {
      flowId: randomUUID(),
      version: 1,
      ...input,
      reviewStatus: "draft",
      createdAt: new Date().toISOString()
    };
    this.flows.set(flow.flowId, flow);
    return flow;
  }

  get(flowId: string): WireflowDocument | undefined {
    return this.flows.get(flowId);
  }
}
