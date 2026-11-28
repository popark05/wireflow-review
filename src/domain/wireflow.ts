import { randomUUID } from "node:crypto";

export type FlowNodeType = "screen" | "decision" | "external";
export type ReviewStatus = "draft" | "in_review" | "approved" | "changes_requested";
export type ReviewDecision = "approved" | "changes_requested";
/** discovered: observed in the running app by Reverse Screen (flow contract 1.1). */
export type ElementOrigin = "product_requirement" | "ai_suggestion" | "open_question" | "discovered";
export type EdgeKind = "primary" | "back" | "cancel" | "retry" | "empty" | "failure";

/** Reference to a runtime fact discovered by Reverse Screen. IDs are copied verbatim from Discovery Events. */
export interface ReverseScreenRef {
  sourceSystem: "reverse-screen";
  screenId?: string;
  stateId?: string;
  transitionId?: string;
  sessionId?: string;
}

export interface FlowNode {
  nodeId: string;
  type: FlowNodeType;
  title: string;
  origin: ElementOrigin;
  discoveryRef?: ReverseScreenRef;
  metadata?: Record<string, unknown>;
}

export interface FlowEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: EdgeKind;
  label?: string;
  trigger?: string;
  origin: ElementOrigin;
  discoveryRef?: ReverseScreenRef;
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
  updatedAt: string;
}

/** Import body: origin and kind are optional and default to product_requirement / primary. */
export interface WireflowInput {
  applicationId: string;
  title: string;
  description?: string;
  nodes: Array<Omit<FlowNode, "origin"> & { origin?: ElementOrigin }>;
  edges: Array<Omit<FlowEdge, "origin" | "kind"> & { origin?: ElementOrigin; kind?: EdgeKind }>;
}

/** Graph content of a new revision; the application stays fixed. */
export type WireflowRevisionInput = Omit<WireflowInput, "applicationId">;

/** Immutable snapshot of a flow version. */
export interface FlowRevision {
  revisionId: string;
  flowId: string;
  version: number;
  document: WireflowDocument;
  createdAt: string;
}

export interface FlowReviewRecord {
  reviewId: string;
  flowId: string;
  flowVersion: number;
  reviewerId: string;
  decision: ReviewDecision;
  comment?: string;
  reviewedAt: string;
}

/** Wire format defined by contracts/flow-model.v1.schema.json. */
export interface FlowModelV1 {
  contractVersion: "1.1";
  sourceSystem: "wireflow-review";
  flowId: string;
  flowVersion: number;
  applicationId: string;
  title: string;
  description?: string;
  approval: { reviewId: string; reviewerId: string; approvedAt: string };
  nodes: Array<Omit<FlowNode, "metadata">>;
  edges: FlowEdge[];
  exportedAt: string;
}

export type ValidationIssue = { path: string; message: string };

type MaybePromise<T> = T | Promise<T>;

/** Storage contract shared by the in-memory store and PostgreSQL; implementations may be sync or async. */
export interface WireflowRepository {
  import(input: WireflowInput): MaybePromise<WireflowDocument>;
  get(flowId: string): MaybePromise<WireflowDocument | undefined>;
  submit(flowId: string): MaybePromise<WireflowDocument | undefined>;
  review(flowId: string, reviewerId: string, decision: ReviewDecision, comment?: string): MaybePromise<FlowReviewRecord | undefined>;
  /** Published flow-model snapshot, or undefined unless the current version is approved. */
  export(flowId: string): MaybePromise<FlowModelV1 | undefined>;
  /** Appends version expectedVersion+1 as a new draft; undefined on a stale version or while in review. */
  createRevision(flowId: string, input: WireflowRevisionInput, expectedVersion: number): MaybePromise<FlowRevision | undefined>;
  listRevisions(flowId: string): MaybePromise<FlowRevision[]>;
  getRevision(flowId: string, version: number): MaybePromise<FlowRevision | undefined>;
}

function withGraphDefaults(input: Pick<WireflowInput, "nodes" | "edges">): Pick<WireflowDocument, "nodes" | "edges"> {
  return {
    nodes: input.nodes.map((node) => ({ ...node, origin: node.origin ?? "product_requirement" })),
    edges: input.edges.map((edge) => ({ ...edge, kind: edge.kind ?? "primary", origin: edge.origin ?? "product_requirement" }))
  };
}

/** Applies import defaults: origin product_requirement, edge kind primary. */
export function createWireflowDocument(input: WireflowInput, now = new Date().toISOString()): WireflowDocument {
  return {
    flowId: randomUUID(),
    version: 1,
    ...structuredClone(input),
    ...withGraphDefaults(structuredClone(input)),
    reviewStatus: "draft",
    createdAt: now,
    updatedAt: now
  };
}

/** Next version of a flow: replaces graph content, resets review to draft. */
export function createRevisionDocument(current: WireflowDocument, input: WireflowRevisionInput, now = new Date().toISOString()): WireflowDocument {
  return {
    ...current,
    ...structuredClone(input),
    ...withGraphDefaults(structuredClone(input)),
    version: current.version + 1,
    reviewStatus: "draft",
    updatedAt: now
  };
}

/** Builds the flow-model contract document for an approved flow and its approving review. */
export function toFlowModel(flow: WireflowDocument, approval: FlowReviewRecord): FlowModelV1 {
  return {
    contractVersion: "1.1",
    sourceSystem: "wireflow-review",
    flowId: flow.flowId,
    flowVersion: flow.version,
    applicationId: flow.applicationId,
    title: flow.title,
    ...(flow.description === undefined ? {} : { description: flow.description }),
    approval: { reviewId: approval.reviewId, reviewerId: approval.reviewerId, approvedAt: approval.reviewedAt },
    nodes: flow.nodes.map(({ metadata: _metadata, ...node }) => node),
    edges: flow.edges,
    exportedAt: new Date().toISOString()
  };
}

export function validateWireflow(input: WireflowInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.applicationId.trim()) issues.push({ path: "applicationId", message: "applicationId is required" });
  if (!input.title.trim()) issues.push({ path: "title", message: "title is required" });
  if (input.nodes.length === 0) issues.push({ path: "nodes", message: "at least one node is required" });

  const nodeIds = new Set<string>();
  for (const [index, node] of input.nodes.entries()) {
    if (nodeIds.has(node.nodeId)) issues.push({ path: `nodes[${index}].nodeId`, message: "nodeId must be unique" });
    nodeIds.add(node.nodeId);
  }
  if (!input.nodes.some((node) => node.type === "screen")) {
    issues.push({ path: "nodes", message: "at least one screen node is required" });
  }

  const edgeIds = new Set<string>();
  for (const [index, edge] of input.edges.entries()) {
    if (edgeIds.has(edge.edgeId)) issues.push({ path: `edges[${index}].edgeId`, message: "edgeId must be unique" });
    edgeIds.add(edge.edgeId);
    if (!nodeIds.has(edge.fromNodeId)) issues.push({ path: `edges[${index}].fromNodeId`, message: "source node does not exist" });
    if (!nodeIds.has(edge.toNodeId)) issues.push({ path: `edges[${index}].toNodeId`, message: "target node does not exist" });
  }
  return issues;
}

const clone = <T>(value: T): T => structuredClone(value);

export class WireflowStore implements WireflowRepository {
  private readonly flows = new Map<string, WireflowDocument>();
  private readonly revisions = new Map<string, FlowRevision[]>();
  private readonly reviews: FlowReviewRecord[] = [];

  import(input: WireflowInput): WireflowDocument {
    const flow = createWireflowDocument(input);
    this.flows.set(flow.flowId, clone(flow));
    this.revisions.set(flow.flowId, [{
      revisionId: randomUUID(), flowId: flow.flowId, version: 1, document: clone(flow), createdAt: flow.createdAt
    }]);
    return clone(flow);
  }

  get(flowId: string): WireflowDocument | undefined {
    const flow = this.flows.get(flowId);
    return flow ? clone(flow) : undefined;
  }

  submit(flowId: string): WireflowDocument | undefined {
    const flow = this.flows.get(flowId);
    if (!flow || (flow.reviewStatus !== "draft" && flow.reviewStatus !== "changes_requested")) return undefined;
    const updated: WireflowDocument = { ...flow, reviewStatus: "in_review", updatedAt: new Date().toISOString() };
    this.flows.set(flowId, updated);
    return clone(updated);
  }

  review(flowId: string, reviewerId: string, decision: ReviewDecision, comment?: string): FlowReviewRecord | undefined {
    const flow = this.flows.get(flowId);
    if (!flow || flow.reviewStatus !== "in_review") return undefined;
    const record: FlowReviewRecord = {
      reviewId: randomUUID(),
      flowId,
      flowVersion: flow.version,
      reviewerId,
      decision,
      ...(comment === undefined ? {} : { comment }),
      reviewedAt: new Date().toISOString()
    };
    this.reviews.push(record);
    this.flows.set(flowId, { ...flow, reviewStatus: decision, updatedAt: record.reviewedAt });
    return clone(record);
  }

  export(flowId: string): FlowModelV1 | undefined {
    const flow = this.flows.get(flowId);
    if (!flow || flow.reviewStatus !== "approved") return undefined;
    const approval = this.reviews
      .filter((review) => review.flowId === flowId && review.flowVersion === flow.version && review.decision === "approved")
      .at(-1);
    if (!approval) return undefined;
    return toFlowModel(clone(flow), approval);
  }

  createRevision(flowId: string, input: WireflowRevisionInput, expectedVersion: number): FlowRevision | undefined {
    const current = this.flows.get(flowId);
    if (!current || current.version !== expectedVersion || current.reviewStatus === "in_review") return undefined;
    const document = createRevisionDocument(current, input);
    const revision: FlowRevision = {
      revisionId: randomUUID(), flowId, version: document.version, document: clone(document), createdAt: document.updatedAt
    };
    this.flows.set(flowId, clone(document));
    this.revisions.get(flowId)!.push(clone(revision));
    return clone(revision);
  }

  listRevisions(flowId: string): FlowRevision[] {
    return clone(this.revisions.get(flowId) ?? []);
  }

  getRevision(flowId: string, version: number): FlowRevision | undefined {
    const revision = this.revisions.get(flowId)?.find((item) => item.version === version);
    return revision ? clone(revision) : undefined;
  }
}
