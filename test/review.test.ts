import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app.js";

test("wireflow can be submitted and approved", async () => {
 const app=buildApp();
 const imported=await app.inject({method:"POST",url:"/v1/flows/import",payload:{
  applicationId:"demo-app",title:"Checkout",
  nodes:[{nodeId:"cart",type:"screen",title:"Cart"},{nodeId:"payment",type:"screen",title:"Payment"}],
  edges:[{edgeId:"cart-payment",fromNodeId:"cart",toNodeId:"payment",trigger:"tap checkout"}]
 }});
 const id=imported.json().flowId;
 const submitted=await app.inject({method:"POST",url:`/v1/flows/${id}/submissions`});
 assert.equal(submitted.json().reviewStatus,"in_review");
 const reviewed=await app.inject({method:"POST",url:`/v1/flows/${id}/reviews`,payload:{reviewerId:"owner",decision:"approved"}});
 assert.equal(reviewed.statusCode,201);
 const fetched=await app.inject({method:"GET",url:`/v1/flows/${id}`});
 assert.equal(fetched.json().reviewStatus,"approved");
 await app.close();
});

test("wireflow cannot be reviewed before submission", async () => {
 const app=buildApp();
 const imported=await app.inject({method:"POST",url:"/v1/flows/import",payload:{
  applicationId:"demo-app",title:"Profile",nodes:[{nodeId:"profile",type:"screen",title:"Profile"}],edges:[]
 }});
 const response=await app.inject({method:"POST",url:`/v1/flows/${imported.json().flowId}/reviews`,payload:{reviewerId:"owner",decision:"approved"}});
 assert.equal(response.statusCode,409);
 await app.close();
});
