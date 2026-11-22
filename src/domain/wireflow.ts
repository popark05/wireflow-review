import { randomUUID } from "node:crypto";
export type FlowNodeType = "screen" | "decision" | "external";
export type ReviewStatus = "draft" | "in_review" | "approved" | "changes_requested";
export interface FlowNode { nodeId: string; type: FlowNodeType; title: string; screenId?: string; stateId?: string; metadata?: Record<string, unknown>; }
export interface FlowEdge { edgeId: string; fromNodeId: string; toNodeId: string; label?: string; trigger?: string; }
export interface WireflowDocument {
  flowId: string; version: number; applicationId: string; title: string; description?: string;
  nodes: FlowNode[]; edges: FlowEdge[]; reviewStatus: ReviewStatus; createdAt: string; updatedAt: string;
}
export interface WireflowInput { applicationId: string; title: string; description?: string; nodes: FlowNode[]; edges: FlowEdge[]; }
export interface FlowReviewRecord { reviewId: string; flowId: string; reviewerId: string; decision: "approved" | "changes_requested"; comment?: string; reviewedAt: string; }
export type ValidationIssue = { path: string; message: string };
export function validateWireflow(input: WireflowInput): ValidationIssue[] {
 const issues: ValidationIssue[]=[];
 if(!input.applicationId.trim()) issues.push({path:"applicationId",message:"applicationId is required"});
 if(!input.title.trim()) issues.push({path:"title",message:"title is required"});
 if(input.nodes.length===0) issues.push({path:"nodes",message:"at least one node is required"});
 const ids=new Set<string>();
 for(const [i,n] of input.nodes.entries()){if(ids.has(n.nodeId))issues.push({path:`nodes[${i}].nodeId`,message:"nodeId must be unique"});ids.add(n.nodeId);}
 if(!input.nodes.some(n=>n.type==="screen"))issues.push({path:"nodes",message:"at least one screen node is required"});
 const edgeIds=new Set<string>();
 for(const [i,e] of input.edges.entries()){
  if(edgeIds.has(e.edgeId))issues.push({path:`edges[${i}].edgeId`,message:"edgeId must be unique"});edgeIds.add(e.edgeId);
  if(!ids.has(e.fromNodeId))issues.push({path:`edges[${i}].fromNodeId`,message:"source node does not exist"});
  if(!ids.has(e.toNodeId))issues.push({path:`edges[${i}].toNodeId`,message:"target node does not exist"});
 }
 return issues;
}
export class WireflowStore {
 private readonly flows=new Map<string,WireflowDocument>();
 private readonly reviews:FlowReviewRecord[]=[];
 import(input:WireflowInput):WireflowDocument{
  const now=new Date().toISOString();
  const flow:WireflowDocument={flowId:randomUUID(),version:1,...input,reviewStatus:"draft",createdAt:now,updatedAt:now};
  this.flows.set(flow.flowId,flow);return flow;
 }
 get(id:string):WireflowDocument|undefined{return this.flows.get(id);}
 submit(id:string):WireflowDocument|undefined{
  const flow=this.flows.get(id);if(!flow||!["draft","changes_requested"].includes(flow.reviewStatus))return undefined;
  const updated={...flow,reviewStatus:"in_review" as const,updatedAt:new Date().toISOString()};this.flows.set(id,updated);return updated;
 }
 review(id:string,reviewerId:string,decision:"approved"|"changes_requested",comment?:string):FlowReviewRecord|undefined{
  const flow=this.flows.get(id);if(!flow||flow.reviewStatus!=="in_review")return undefined;
  const record:FlowReviewRecord={reviewId:randomUUID(),flowId:id,reviewerId,decision,...(comment===undefined?{}:{comment}),reviewedAt:new Date().toISOString()};
  this.reviews.push(record);this.flows.set(id,{...flow,reviewStatus:decision,updatedAt:record.reviewedAt});return record;
 }
}
