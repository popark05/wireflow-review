import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  FlowReviewRecord, ReviewStatus, WireflowDocument, WireflowInput, WireflowRepository
} from "../domain/wireflow.js";

export class PostgresWireflowStore implements WireflowRepository {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS wireflow_flows (
        flow_id UUID PRIMARY KEY,
        application_id TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version > 0),
        review_status TEXT NOT NULL CHECK (review_status IN ('draft', 'in_review', 'approved', 'changes_requested')),
        document JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS wireflow_flows_application_updated_idx
        ON wireflow_flows (application_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS wireflow_reviews (
        review_id UUID PRIMARY KEY,
        flow_id UUID NOT NULL REFERENCES wireflow_flows(flow_id) ON DELETE CASCADE,
        reviewer_id TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
        comment TEXT,
        reviewed_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS wireflow_reviews_flow_reviewed_idx
        ON wireflow_reviews (flow_id, reviewed_at DESC);
    `);
  }

  async import(input: WireflowInput): Promise<WireflowDocument> {
    const now = new Date().toISOString();
    const flow: WireflowDocument = {
      flowId: randomUUID(), version: 1, ...input,
      reviewStatus: "draft", createdAt: now, updatedAt: now
    };
    await this.pool.query(
      `INSERT INTO wireflow_flows
        (flow_id, application_id, version, review_status, document, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz)`,
      [flow.flowId, flow.applicationId, flow.version, flow.reviewStatus, JSON.stringify(flow), now, now]
    );
    return flow;
  }

  async get(id: string): Promise<WireflowDocument | undefined> {
    const result = await this.pool.query<{ document: WireflowDocument }>(
      "SELECT document FROM wireflow_flows WHERE flow_id = $1",
      [id]
    );
    return result.rows[0]?.document;
  }

  async submit(id: string): Promise<WireflowDocument | undefined> {
    const updatedAt = new Date().toISOString();
    const result = await this.pool.query<{ document: WireflowDocument }>(
      `UPDATE wireflow_flows
       SET review_status = 'in_review',
           document = jsonb_set(
             jsonb_set(document, '{reviewStatus}', to_jsonb('in_review'::text)),
             '{updatedAt}', to_jsonb($2::text)
           ),
           updated_at = $2::timestamptz
       WHERE flow_id = $1 AND review_status IN ('draft', 'changes_requested')
       RETURNING document`,
      [id, updatedAt]
    );
    return result.rows[0]?.document;
  }

  async review(
    id: string,
    reviewerId: string,
    decision: "approved" | "changes_requested",
    comment?: string
  ): Promise<FlowReviewRecord | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ review_status: ReviewStatus }>(
        "SELECT review_status FROM wireflow_flows WHERE flow_id = $1 FOR UPDATE",
        [id]
      );
      if (current.rows[0]?.review_status !== "in_review") {
        await client.query("ROLLBACK");
        return undefined;
      }

      const reviewedAt = new Date().toISOString();
      const record: FlowReviewRecord = {
        reviewId: randomUUID(), flowId: id, reviewerId, decision,
        ...(comment === undefined ? {} : { comment }),
        reviewedAt
      };
      await client.query(
        `INSERT INTO wireflow_reviews
          (review_id, flow_id, reviewer_id, decision, comment, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
        [record.reviewId, id, reviewerId, decision, comment ?? null, reviewedAt]
      );
      await client.query(
        `UPDATE wireflow_flows
         SET review_status = $2,
             document = jsonb_set(
               jsonb_set(document, '{reviewStatus}', to_jsonb($2::text)),
               '{updatedAt}', to_jsonb($3::text)
             ),
             updated_at = $3::timestamptz
         WHERE flow_id = $1`,
        [id, decision, reviewedAt]
      );
      await client.query("COMMIT");
      return record;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
