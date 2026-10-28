# Research Design initial-draft backend repair

Date: 2026-10-06.

The backend can now start a durable design run without a pre-confirmed methodology profile when the project has no accepted specification and the proposed input has methodology version 0. Existing profile versions and accepted revisions retain their concurrency fences. Acceptance still creates the methodology profile and canonical revision in the same transaction.

Topic-only inputs first receive answerable population/problem clarifications without calling a provider. Once those inputs exist, the existing bounded reasoning service can propose an initial linked canonical graph. It uses the same model router, token/call/credit ceilings, durable checkpoints, cancellation and ownership checks. It does not write proposal sections or accept its own recommendation.

The initial output boundary preserves supplied scope, project preferences, existing IDs/text, numeric sampling inputs and hypotheses. It rejects fabricated source availability, permissions, resource confirmations, measurement provenance, operational counts, missingness estimates and evidence decisions. Every graph is passed to existing deterministic validation. Missing resources, sample adequacy and other methodological safeguards remain blockers.

The input API now supports a `Specification` clarification with `value.specification` containing a proposed canonical draft. Owned run views expose the exact `draft` for that command. This proposes a new run and preserves expected-version/idempotency checks; it does not accept the design. Prompt version v2 supersedes incompatible old reasoning/cache results without rewriting accepted JSON.

## Scope and remaining UX boundary

This repair changes the backend. The current student question component supports Text and AccessConfirmation only. It does not yet render the new Specification clarification. Therefore initial design creation is enabled, but the complete student journey still requires frontend structured-revision wiring. Do not describe these backend changes as a verified live topic-to-accepted-proposal journey.

No migration or development-data backfill was added. Tests use mocked providers and disposable test databases. No paid model call was initiated for verification.

## Validation

The broad Research Design plus journey selection passed **416 tests, 0 failed, 0 skipped**. After the final initial-context and malformed-input guard changes, the focused selection passed **76 tests, 0 failed, 0 skipped**, including typed exact-draft input and no-profile durable recovery/atomic acceptance. These counts overlap and must not be added. TRX files: `../Humaniser/HumaniseAI.IntegrationTests/TestResults/research-design-initial-draft-fix.trx` and `research-design-initial-draft-final.trx`.

The API compiled successfully as part of the test build. Existing compiler/analyzer warnings remain. The local API was restarted with automatic database migration disabled. No student acceptance command or proposal-content write was performed for verification.
