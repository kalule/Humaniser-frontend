# Proposal engine implementation status

Updated 4 October 2026. The architecture is implemented in the frontend and sibling Humaniser API as an explicitly accepted proposal workflow. This supersedes the earlier safety-only status. The original architecture assessment remains a historical source inspection.

## Implemented

- Startup requires confirmed methodology. Geography, population and source mode persist correctly. Malformed/unavailable reviews return Unknown. Jobs pause at NeedsReview without dismissing integrity conflicts. Recovery handles closing/reopening and preserves resume settings.
- Immutable schema-versioned CanonicalResearchPlan revisions govern accepted designs. ResearchProject points to its accepted same-project revision. Acceptance requires explicit reconciliation and the expected revision, using PostgreSQL transaction/advisory locking and a concurrency token. Historical snapshots retain schema version zero and no accepted pointer.
- Stable question, objective, construct, data-source, analysis and hypothesis IDs capture the research graph, objective type, hypothesis applicability/rationale, measurement definitions, assumptions and missing-data handling. Retired compatibility records remain historical. Prose synchronization and older typed mutation paths cannot replace accepted decisions.
- Versioned sampling calculations implement Cochran proportion precision, optional finite-population correction, design effect, response inflation, upward rounding and a balanced two-group normal approximation. Qualitative sampling records an information-power/saturation rationale. Unsupported designs remain Unknown and block acceptance; methodological adequacy still requires examiner review.
- Exact evidence binds an owned included source, coverage, offset/length/quote and source/corpus hashes to a specific claim. Semantic entailment is reviewed for that pair. New decisions supersede older ones. Retracted, missing, changed, unknown or failed evidence cannot authorize writing.
- Gap dossiers reference supporting/counterevidence, query IDs, actual provider executions, scope and coverage limitations. A completed discovery flag alone is insufficient. Search changes invalidate the dossier.
- Section contracts allocate weighted prose budgets with institution overrides, applicability, word ranges and accepted prerequisites. Abstract is generated last. A current reviewed gap precedes dependent writing. Specification changes conservatively invalidate prose because generation prompts receive the full design.
- Immutable generation attempts record unique retry keys, accepted revision, expected section version, full rendered system/input/corpus snapshot, prompt/policy/parameters, raw output and actual model/token/retry/fallback telemetry. Every evidence token must follow its precise authorized claim. Slow requests cannot overwrite a newer edit or publish against changed inputs.
- Shared readiness checks serve section acceptance, semantic/examiner reviews and finalization. Current evidence, deterministic rules, required section acceptance and both successful reviews are independent barriers. Finalization pins the reviewed fingerprint and stores exact DOCX bytes, SHA-256, section hashes/versions and review/specification/corpus references. Archived downloads retain those bytes after later edits.
- Research & Submission Review provides design, exact passage selection, gap assessment, generation/acceptance, bound researcher edits, submission blockers and archived downloads. The API adapter uses the shared client's existing response unwrapping.

## Compatibility and rollout

Legacy projects remain imported drafts until the researcher accepts a reconciled design. Existing draft downloads remain available. Existing generation/job entry points delegate to enforcement once a proposal has an accepted revision. Thesis/dissertation workflows retain their existing behavior. Generation completion does not mean submission readiness.

Two additive API migrations are prepared:

- `20261004072013_AddProposalWorkflowArchitecture`
- `20261004075853_AddAcceptedHypothesisRetirement`

They were exercised against disposable PostgreSQL databases. No deployed database was changed. Deploy the matching API/frontend together and apply migrations through the existing process. Previously completed discovery runs lack execution records and must be rerun to substantiate a gap. Historical content is never backfilled as Verified.

See [operation and rollout notes](proposal-engine-workflow.md) for the user sequence, implementation locations and checks.

## Validation

- Frontend production build passes; 191 tests pass across 31 files.
- API compiles; 99 targeted architecture/PostgreSQL/safety/legacy regression tests pass. Coverage includes disposable PostgreSQL migrations, authenticated acceptance, same-project foreign keys and native retry uniqueness.
- The full review-to-DOCX fixture verifies immutable downloads and later-edit invalidation. Failure coverage includes passage mismatch, unsupported claims, malformed/provider reviews, corpus edits, duplicate attempts, concurrent edits, cancellation, sampling and missing search executions.
- Playwright desktop/mobile smoke checks pass for design/hypotheses, evidence, concurrent editor revisions and blocked finalization. Browser APIs and backend providers use fixtures/mocks.
- Existing nullable and bundling warnings remain. The full backend suite and live provider/model scholarly-quality evaluation have not been certified. Deployment and separately budgeted live evaluation remain rollout work.
