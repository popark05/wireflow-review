import { Pool } from "pg";
import { PostgresWireflowStore } from "../infrastructure/postgres-wireflow-store.js";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? "0.0.0.0";
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 10) })
  : undefined;
const repository = pool ? new PostgresWireflowStore(pool) : undefined;

if (repository) await repository.initialize();

const app = buildApp(repository);
if (pool) app.addHook("onClose", async () => { await pool.end(); });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}
