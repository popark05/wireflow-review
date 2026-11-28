# Wireflow Review

Wireflow Review is the planning-time companion in the screen-quality toolchain. It helps product and design teams inspect an application's information architecture and task flows before visual design is finalized.

It turns product notes and existing screens into a clickable wireflow of lightweight mock screens connected by transitions. Reviewers can trace a task, inspect alternate outcomes, and identify missing, ambiguous, or inconsistent steps.

## Core capabilities
- Group screens by user task and highlight an end-to-end path.
- Inspect back, cancel, retry, empty, and failure paths.
- Distinguish required product behavior from AI-suggested structure and unresolved questions.
- Produce structured flow artifacts that can later be imported into Reverse Screen.

## Related repositories
| Repository | Responsibility |
|---|---|
| [reverse-screen](https://github.com/popark05/reverse-screen) | Discover runtime screens, states, elements, and transitions |
| [qa-platform](https://github.com/popark05/qa-platform) | Author, manage, execute, and report QA test cases |

Wireflow Review is a planning/review tool. It does not own runtime discovery sessions or QA test execution.

## Upstream reference
The original XU Wireflow Review skill and release assets are maintained at [JeongK7998/wireflow-review](https://github.com/JeongK7998/wireflow-review). This repository is the separate development home for the popark05 toolchain; upstream source/assets have not been copied wholesale.

## Status
API for importing and validating a wireflow graph, keeping immutable revisions, submitting it, recording a review decision, and exporting approved flows as the `flow-model` contract (1.1).

- Contract: [`contracts/flow-model.v1.schema.json`](contracts/flow-model.v1.schema.json)
- Design decisions (Korean): [`docs/architecture/flow-contract.md`](docs/architecture/flow-contract.md)
- Storage: in-memory by default; PostgreSQL when `DATABASE_URL` is configured (tables and indexes are created at startup).

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/flows/import` | Import a flow graph (optional `origin`, `kind`, `discoveryRef`) |
| GET | `/v1/flows/{flowId}` | Read the current flow |
| POST | `/v1/flows/{flowId}/revisions` | Create the next revision (`expectedVersion`, `title`, `nodes`, `edges`, optional `description`) |
| GET | `/v1/flows/{flowId}/revisions` | List immutable revision snapshots |
| GET | `/v1/flows/{flowId}/revisions/{version}` | Read one revision snapshot |
| POST | `/v1/flows/{flowId}/submissions` | Submit for review |
| POST | `/v1/flows/{flowId}/reviews` | Approve or request changes (bound to the current version) |
| GET | `/v1/flows/{flowId}/export` | Export the approved current version (`flow-model`) |

Creating a revision resets review status to `draft`; it is rejected while the flow is `in_review` or when `expectedVersion` is stale. Export publishes only an approval of the current version, so a new revision is not exported until it is reviewed again. PostgreSQL stores snapshots in `wireflow_revisions` with a unique `(flow_id, version)` constraint; existing flows are backfilled with their current document as the initial available revision at startup, which cannot reconstruct versions that predate the table.

```bash
npm install
npm run typecheck && npm test && npm run build
npm run dev   # PORT defaults to 3002
```

A browser-based visual editor is served at `/editor`: open a flow by ID, add screen/decision/external steps, drag to arrange (positions are kept in node metadata), connect steps with labels and triggers, and save — the first save imports, later saves create immutable revisions. Reverse Screen references and origins of imported nodes are shown read-only.

## License
To be decided before public distribution.
