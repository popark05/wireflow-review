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
Early API (in-memory): import and validate a wireflow graph, submit it, record a review decision, and export approved flows as the `flow-model` v1 contract.

- Contract: [`contracts/flow-model.v1.schema.json`](contracts/flow-model.v1.schema.json)
- Design decisions (Korean): [`docs/architecture/flow-contract.md`](docs/architecture/flow-contract.md)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/flows/import` | Import a flow graph (optional `origin`, `kind`, `discoveryRef`) |
| GET | `/v1/flows/{flowId}` | Read the current flow |
| POST | `/v1/flows/{flowId}/submissions` | Submit for review |
| POST | `/v1/flows/{flowId}/reviews` | Approve or request changes |
| GET | `/v1/flows/{flowId}/export` | Export an approved flow (`flow-model` v1) |

```bash
npm install
npm run typecheck && npm test && npm run build
npm run dev   # PORT defaults to 3002
```

## License
To be decided before public distribution.