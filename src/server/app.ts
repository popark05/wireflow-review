import Fastify,{type FastifyInstance} from "fastify";
import { validateWireflow, WireflowStore, type WireflowInput, type WireflowRepository } from "../domain/wireflow.js";
const importSchema={type:"object",additionalProperties:false,required:["applicationId","title","nodes","edges"],properties:{
 applicationId:{type:"string",minLength:1,maxLength:200},title:{type:"string",minLength:1,maxLength:240},description:{type:"string",maxLength:4000},
 nodes:{type:"array",minItems:1,items:{type:"object",additionalProperties:false,required:["nodeId","type","title"],properties:{
 nodeId:{type:"string",minLength:1,maxLength:200},type:{type:"string",enum:["screen","decision","external"]},title:{type:"string",minLength:1,maxLength:240},screenId:{type:"string"},stateId:{type:"string"},metadata:{type:"object"}}}},
 edges:{type:"array",items:{type:"object",additionalProperties:false,required:["edgeId","fromNodeId","toNodeId"],properties:{
 edgeId:{type:"string",minLength:1,maxLength:200},fromNodeId:{type:"string",minLength:1,maxLength:200},toNodeId:{type:"string",minLength:1,maxLength:200},label:{type:"string",maxLength:240},trigger:{type:"string",maxLength:240}}}}
}} as const;
const revisionSchema={type:"object",additionalProperties:false,required:["expectedVersion","title","nodes","edges"],properties:{
 expectedVersion:{type:"integer",minimum:1},title:{type:"string",minLength:1,maxLength:240},description:{type:"string",maxLength:4000},
 nodes:importSchema.properties.nodes,edges:importSchema.properties.edges
}} as const;
const reviewSchema={type:"object",additionalProperties:false,required:["reviewerId","decision"],properties:{
 reviewerId:{type:"string",minLength:1,maxLength:200},decision:{type:"string",enum:["approved","changes_requested"]},comment:{type:"string",maxLength:4000}
}} as const;
type RevisionBody = { expectedVersion: number; title: string; description?: string; nodes: WireflowInput["nodes"]; edges: WireflowInput["edges"] };
export function buildApp(store: WireflowRepository = new WireflowStore()): FastifyInstance {
 const app=Fastify({logger:true});
 app.get("/health",async()=>({status:"ok",service:"wireflow-review"}));
 app.post<{Body:WireflowInput}>("/v1/flows/import",{schema:{body:importSchema}},async(req,reply)=>{
  const issues=validateWireflow(req.body);if(issues.length)return reply.code(422).send({error:"invalid_wireflow",issues});
  return reply.code(201).send(await store.import(req.body));
 });
 app.get<{Params:{flowId:string}}>("/v1/flows/:flowId",async(req,reply)=>{
  const flow=await store.get(req.params.flowId);if(!flow)return reply.code(404).send({error:"flow_not_found"});return flow;
 });
 app.post<{Params:{flowId:string};Body:RevisionBody}>("/v1/flows/:flowId/revisions",{schema:{body:revisionSchema}},async(req,reply)=>{
  const current=await store.get(req.params.flowId);
  if(!current)return reply.code(404).send({error:"flow_not_found"});
  const input={applicationId:current.applicationId,title:req.body.title,description:req.body.description,nodes:req.body.nodes,edges:req.body.edges};
  const issues=validateWireflow(input);if(issues.length)return reply.code(422).send({error:"invalid_wireflow",issues});
  const revision=await store.createRevision(req.params.flowId,{title:req.body.title,description:req.body.description,nodes:req.body.nodes,edges:req.body.edges},req.body.expectedVersion);
  if(!revision)return reply.code(409).send({error:"revision_conflict",message:"expectedVersion is stale or the flow is currently in review"});
  return reply.code(201).send(revision);
 });
 app.get<{Params:{flowId:string}}>("/v1/flows/:flowId/revisions",async(req,reply)=>{
  if(!await store.get(req.params.flowId))return reply.code(404).send({error:"flow_not_found"});
  return store.listRevisions(req.params.flowId);
 });
 app.get<{Params:{flowId:string;version:string}}>("/v1/flows/:flowId/revisions/:version",async(req,reply)=>{
  const version=Number(req.params.version);
  if(!Number.isSafeInteger(version)||version<1)return reply.code(400).send({error:"invalid_revision_version"});
  const revision=await store.getRevision(req.params.flowId,version);
  if(!revision)return reply.code(404).send({error:"revision_not_found"});
  return revision;
 });
 app.post<{Params:{flowId:string}}>("/v1/flows/:flowId/submissions",async(req,reply)=>{
  const flow=await store.submit(req.params.flowId);if(!flow)return reply.code(409).send({error:"flow_cannot_be_submitted"});return flow;
 });
 app.post<{Params:{flowId:string};Body:{reviewerId:string;decision:"approved"|"changes_requested";comment?:string}}>("/v1/flows/:flowId/reviews",{schema:{body:reviewSchema}},async(req,reply)=>{
  const review=await store.review(req.params.flowId,req.body.reviewerId,req.body.decision,req.body.comment);
  if(!review)return reply.code(409).send({error:"flow_not_in_review"});return reply.code(201).send(review);
 });
 return app;
}
