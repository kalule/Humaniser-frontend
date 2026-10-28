# Research Design compact bootstrap and system-experiment correction

Date: 2026-10-06. Implements the correction described in [the failed-run investigation](research-design-run-97ec7dd6-investigation-2026-10-06.md).

## What changed

The initial provider response is a compact linked outline, not `ResearchSpecificationInput` plus a candidate comparison. It contains one tentative family/design/intent, bounded question/construct/source/analysis/objective records and short local keys. The application assigns project/input-fingerprint-scoped deterministic IDs, restores supplied canonical records and materializes the existing specification. Saved population/scope, referencing preferences, sampling numbers, resources, evidence and authority fields are not model output fields.

The expansive recursive bootstrap schema and its old prompt were removed. Initial transport is limited to three questions/objectives, four constructs, two sources and two analyses; text fields are limited to 300 characters and the transport to 16,000 bytes. Unknown fields, duplicate keys, invalid references, unsupported families and authority-bearing additions fail closed. Unsupported/ambiguous families can return a bounded `RequiresInput` response without a candidate. New mixed-method bootstrap is explicitly unsupported until its separate strand decisions can be supplied; existing typed mixed-method reasoning remains.

Materialization occurs before the existing durable completion checkpoint. Stored checkpoints retain the normal internal candidate/result contract, so replay does not require another model call. Comparison dimensions are explicitly `Unknown`; the application does not manufacture suitability assessments. Existing validators decide readiness and acceptance remains explicit and atomic.

Prompt version is `research-design.reasoning.v6`; methodological policy is `research-design.methodology.v3`. Model routing, provider output allowance, credit caps and physical-attempt limits were not increased. Truncated provider responses remain rejected. Durable attempts now distinguish `OutputTruncated`, malformed output, cancellation and provider failure. Successful dispatches with unusable output retain the existing charging policy; unknown raw output is discarded rather than checkpointed.

## Subject and experiment contracts

Optional `Study.Subject` extends the existing canonical JSON, with `Unknown`, `HumanParticipants`, `SoftwareSystemExperiment` and `SecondaryData`. This is a separate axis from quantitative/qualitative/mixed approach. A model-suggested subject is unconfirmed; confirmed supplied subject values are preserved. Historical payloads without this extension remain readable and are not rewritten.

Software experiments have explicit experimental unit, conditions, independent repetitions, independence rationale, allocation plan and canonical telemetry-source IDs. `InstrumentedTelemetry` extends the closed collection taxonomy. Rules `RD-SUBJECT-001/002` and `RD-SYSTEM-001/002/003/004` block missing confirmation, contradictory subject contracts, missing experiment structure, broken telemetry links, human-participant requirements and telemetry/condition-count mismatch. Repetition counts alone never certify statistical power; existing dependence, measurement, missingness, evidence, feasibility and sample-adequacy gates still apply.

The existing population text is preserved as supplied scope, not automatically rewritten or interpreted as a human sample. Student input previously mixed systems, treatments and logs; that text must be reconciled with the explicit units/conditions/source fields. This change does not infer scientifically defensible independence or verify empirical access from prose.

## Structured follow-up and proposal safeguards

Input commands for typed drafts containing the new subject contract persist an application-controlled validation-only mode. The worker revalidates the student draft without regenerating the full graph with an LLM. The mode participates in the input fingerprint and is preserved when checking run currency after restart. Routing metadata may be resolved locally; no provider call or credit reservation occurs on this path. Readiness, evidence dependencies and explicit acceptance remain unchanged gates.

Subject/experiment changes participate in dependency impact analysis. Section context compiler v2 includes the subject and relevant experiment facts in methods sections, without injecting the whole plan. Existing Phase 8 generation, revision, evidence and student-edit fences remain. The API view exposes the canonical subject; the current details editor supports experiment inputs and the review distinguishes systems in scope, experimental units, conditions and telemetry. No new shell/navigation/components were introduced.

## Files

Backend paths relative to `../Humaniser`:

- New: `HumaniseAI.Application/DTOs/Research/DesignBootstrapContracts.cs`; `HumaniseAI.Infrastructure/Services/ResearchDesign/DesignBootstrapMaterializer.cs`, `StudySubjectRules.cs`; `HumaniseAI.IntegrationTests/DesignBootstrapTests.cs`.
- Extended existing StudySpecification, reasoning/lifecycle/API contracts, initial-draft boundary, prompts, reasoning service, execution settlement, lifecycle snapshots, application view, context builder, impact analyzer, foundation/methodological validation and proposal section context compiler.
- Extended `ResearchDesignReasoningTests` and `ResearchDesignPostgresTests`.

Frontend: existing research-design details editor/review, contract types, detail helpers and tests. Added `scripts/research-design-bootstrap-smoke.mjs` with [mocked browser results](research-design-bootstrap-browser/results.json).

## Verification

- Broad Research Design/proposal/journey selection: **475 passed**, before the final deterministic-input/checkpoint refinements.
- Focused follow-up selection: **127 passed**, overlapping the broad run.
- Disposable-Postgres worker-reload/validation-only test: **1 passed**, no second provider call and zero consumed credits on that input run.
- Final bootstrap/reasoning preservation selection: **88 passed**, including preserved student metadata, unsupported-family input, normalized checkpoints and typed truncation failures. These overlap earlier selections and are not additive test counts.
- Frontend: **370 passed**, production build and TypeScript passed. Existing bundle/auth-import warnings remain.
- Browser: **24 assertions passed**, no browser errors; all API calls mocked, no development database writes.

Provider mocks prove contract, orchestration and validation behavior, not live methodological quality or an `end_turn` outcome from Claude. The compact fixture is under 3,000 JSON characters; this is not an actual provider token measurement. No live AI/literature calls, schema migrations, development-data mutation or Academic Reviewer work occurred. Existing unrelated working-tree changes were preserved; global diff checks contain pre-existing whitespace issues outside this correction.

## Use and remaining limits

Restart the API to load the backend changes, refresh Proposal Studio and start a new attempt with **Try again**. Historical failed runs remain historical; their rejected responses are not recovered or approved. Review the proposed subject, separate systems from experimental conditions and telemetry, and complete the relevant structured findings before acceptance.

This correction does not add a computing-specific power calculator, automatically resolve methodological judgments, verify access to experimental resources or certify a complete live topic-to-proposal journey. Large legacy graphs exceeding the compact bootstrap boundary need explicit reconciliation rather than an expanded provider response. Fail-closed validation remains the intended behavior for those unresolved cases.
