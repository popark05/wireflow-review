import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { PostgresWireflowStore } from "../src/infrastructure/postgres-wireflow-store.js";

const connectionString = process.env.PG_INTEGRATION_URL;

test("real PostgreSQL persists flows, version-bound reviews and the approved export", { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString });
  try {
    const store = new PostgresWireflowStore(pool);
    await store.initialize();
    await store.initialize(); // idempotent, including the flow_version column migration

    const flow = await store.import({
      applicationId: "now-in-android", title: "Discovered navigation",
      nodes: [
        { nodeId: "home", type: "screen", title: "Now in Android", origin: "discovered" },
        { nodeId: "search", type: "screen", title: "Recent searches" }
      ],
      edges: [{ edgeId: "search", fromNodeId: "home", toNodeId: "search", label: "Search", origin: "discovered",
        discoveryRef: { sourceSystem: "reverse-screen", transitionId: "3e6ca0a2-0000-8000-8000-000000000001" } }]
    });
    assert.equal(flow.nodes[1]?.origin, "product_requirement", "import defaults are applied");
    assert.equal(flow.edges[0]?.kind, "primary");
    assert.equal(await store.export(flow.flowId), undefined, "drafts are not exportable");

    assert.equal((await store.submit(flow.flowId))?.reviewStatus, "in_review");
    const review = await store.review(flow.flowId, "pm", "approved");
    assert.equal(review?.flowVersion, 1);
    assert.equal(await store.review(flow.flowId, "pm", "approved"), undefined, "a decided flow cannot be reviewed again");

    // A new store instance over the same database sees the persisted state.
    const reopened = new PostgresWireflowStore(pool);
    const model = await reopened.export(flow.flowId);
    assert.equal(model?.contractVersion, "1.1");
    assert.equal(model?.approval.reviewId, review?.reviewId);
    assert.equal(model?.edges[0]?.discoveryRef?.transitionId, "3e6ca0a2-0000-8000-8000-000000000001");
    assert.equal(model?.nodes[0]?.origin, "discovered");

    // Revisions: a new version is a draft, so export stops until that version is approved.
    const revision = await reopened.createRevision(flow.flowId, {
      title: "Discovered navigation v2",
      nodes: [{ nodeId: "home", type: "screen", title: "Now in Android", origin: "discovered" }], edges: []
    }, 1);
    assert.equal(revision?.version, 2);
    assert.equal(await reopened.createRevision(flow.flowId, { title: "stale", nodes: revision!.document.nodes, edges: [] }, 1), undefined);
    assert.equal(await reopened.export(flow.flowId), undefined, "approval of version 1 does not publish version 2");
    assert.deepEqual((await reopened.listRevisions(flow.flowId)).map((item) => item.version), [1, 2]);
    assert.equal((await reopened.getRevision(flow.flowId, 1))?.document.title, "Discovered navigation");
    await reopened.submit(flow.flowId);
    await reopened.review(flow.flowId, "pm", "approved");
    assert.equal((await reopened.export(flow.flowId))?.flowVersion, 2);
  } finally {
    await pool.end();
  }
});
