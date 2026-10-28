# Research Design API v1

Base: `/api/v1/research/projects/{projectId}/design`. Authentication uses the existing bearer token. Project access is owner-only, matching the existing runtime; collaborator access is not introduced here.

Successful responses use `{ "success": true, "data": ... }`. Queries return the requested view/history in `data`; commands return `{ "view": ..., "idempotencyHit": ..., "backgroundWork": ... }`. The backend owns `allowedActions`. Render those actions and submit the corresponding typed command; do not infer permission from confidence, finding counts, or a locally reconstructed state machine.

| Method | Relative path | Result |
|---|---|---|
| GET | `/` | Latest relevant `ResearchDesignView`, or the current canonical/imported setup when no relevant run exists |
| GET | `/runs/{runId}` | Owned run view, including historical/stale state |
| GET | `/history?take=20&cursor={runId}` | Newest-first page; `take` 1–50, optional owned cursor, `nextCursor` |
| POST | `/runs` | Create a durable run or return a compatible existing run |
| POST | `/runs/{runId}/input` | Answer an active typed question and create its successor run |
| POST | `/runs/{runId}/accept` | Explicitly accept the validated recommended server-side candidate |
| POST | `/runs/{runId}/revisions` | Create a revision; also implements the advertised Restart action for eligible stopped runs |
| POST | `/runs/{runId}/cancel` | Persist cancellation and propagate it to owned evidence work |

Start:

```json
{
  "idempotencyKey": "11111111-1111-4111-8111-111111111111",
  "expectedSpecificationRevision": null
}
```

Use the current accepted revision UUID instead of `null` when one exists. The server loads the specification; arbitrary prompts, replacement specifications, and client-owned readiness are not accepted.

Input:

```json
{
  "idempotencyKey": "22222222-2222-4222-8222-222222222222",
  "expectedVersion": "<version from the view>",
  "questionId": "<active question ID from the view>",
  "value": { "text": "The student's confirmed answer" }
}
```

For `valueType: "AccessConfirmation"`, send `populationAccess`, `dataAvailable`, and `permissionsResolved` booleans instead of `text`. The view provides `answerable`, `field`, `valueType`, and `maxLength`. Current writable fields are research problem, target population, geography, temporal scope, sampling frame/rationale, and the existing research-access clarification. An unrecognized specialist clarification is visible with `answerable: false`; it is not converted into an arbitrary JSON patch. Structural specification changes require the canonical specification workflow rather than this scalar-answer endpoint.

Accept, revise/restart, and cancel use:

```json
{
  "idempotencyKey": "33333333-3333-4333-8333-333333333333",
  "expectedVersion": "<version from the view>",
  "expectedSpecificationRevision": "<canonicalRevision from the view, or null>"
}
```

For acceptance, the expected specification revision is the revision against which the ready run was produced. The command sends no candidate content, methodology, readiness, or blocker overrides. Save the exact command for safe retries. Reusing a key with different contents conflicts. After a successful input/revision command, use the returned successor `runId` and `version`.

The view contains research summary, typed family/methodology, recommended and alternative candidates, RQs/objectives/alignment, population/sampling/sample adequacy, constructs, instruments, collection and analysis, applicable qualitative/mixed/feasibility/ethics sections, evidence summaries, deterministic findings, questions, readiness, budget attention, and allowed actions. It does not contain leases, checkpoints, fingerprints, raw model responses, search queries, abstracts, audit history, or provider pricing.

Progress reports durable stage/phase, start time, parent execution elapsed time, and explicit evidence revalidation. It does not invent a completion percentage or ETA. Evidence summaries distinguish queued, investigating, resolving, complete, unresolved, stopped, and waiting work; current verification can mark previously supported evidence stale.

| Situation | Typical actions |
|---|---|
| No relevant run | Start |
| Created/running | Cancel; Created is already queued |
| RequiresInput with supported answer schemas | ProvideInput, Cancel |
| RequiresEvidence | Cancel |
| ReadyForReview with current gates | Accept, Revise, Cancel |
| Accepted current run | View, Revise |
| Eligible cancelled/failed/budget-exhausted run | View, Restart |
| Superseded/historical terminal run | View |
| Stale unfinished run | View, Cancel |

Every command checks state again. A view is not an acceptance attestation: the acceptance transaction rechecks the complete fingerprint, owned evidence, validation, expected revision/version, and generation fences. A concurrent change can produce a conflict after a successful read.

HTTP: 200 for reads/idempotent results and completed commands; 202 for newly persisted background work; 400 for malformed/schema-invalid requests; 401 for anonymous access; 404 for invisible projects/runs; 409 for stale/conflicting state; 422 for unresolved validation/input/evidence gates; existing 402 billing convention where a synchronous credit failure applies; existing 429 mutation rate limiting. Runtime credit failures can instead arrive asynchronously in the run view.

Research Design errors use the platform's existing error-envelope convention:

```json
{
  "success": false,
  "error": {
    "code": "RESEARCH_DESIGN_STALE_REVISION",
    "message": "A safe action-oriented message",
    "correlationId": "<request correlation>"
  }
}
```

Requests are limited to 16 KB; text answers also have validated per-field limits. Unknown request properties and unnamed enum values are rejected. Mutations reuse the per-user plan limiter (`ResearchDesignPerMinute`, default 10/minute); reads are not added to that limiter. New durable rows remain recoverable by existing sweeps if immediate job enqueue fails. Polling is sufficient for v1.

The API appears in the existing Swagger document under **Research Design**. Apply required existing Phase 4/5 migrations through the deployment process before using these endpoints on a database lacking those columns. Phase 6 creates and applies no migration.
