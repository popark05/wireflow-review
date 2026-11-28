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

## Current implementation status
- Fastify API for importing, retrieving, submitting, and reviewing wireflows.
- Domain validation for node and edge identity and graph references.
- In-memory repository for local development and tests.
- Optional PostgreSQL persistence when `DATABASE_URL` is configured.
- Immutable revision snapshots, optimistic concurrency via `expectedVersion`, and revision lookup/list APIs.
- Browser based visual wireflow editor at `/editor`, with draggable nodes, editable screen/decision/external steps, labeled connections, and persistence through imports/revisions.

Revision API:
- `POST /v1/flows/:flowId/revisions` creates the next revision. The request includes `expectedVersion`, `title`, `nodes`, `edges`, and optional `description`.
- `GET /v1/flows/:flowId/revisions` lists revision metadata and snapshots.
- `GET /v1/flows/:flowId/revisions/:version` retrieves one immutable snapshot.
- Creating a revision resets review status to `draft`; it is rejected while the flow is `in_review` or when `expectedVersion` is stale.

PostgreSQL stores snapshots in `wireflow_revisions` with a unique `(flow_id, version)` constraint. Existing flows are backfilled with their current document as the initial available revision at startup. This cannot reconstruct historical versions that predate the revision table.

The editor is a focused first version: load an existing flow by ID, compose and arrange its graph, and save new immutable revisions. Reverse Screen import/compare integration is not yet implemented.

## License
To be decided before public distribution.
