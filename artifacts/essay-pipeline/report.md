# Essay pipeline implementation and validation — 29 October 2026

Implemented a flag-controlled compact path for the built-in .NET writer. Existing model configuration, Python-runner routing, editor autosave and generation recovery remain in place.

## Changes

- One compact backend question plan by default; an explicitly reviewed frontend plan is reused. Legacy clients/rollout-off requests still work, including warm prepared-evidence cache hits.
- Canonical deduplication and component-interleaved relevance ranking before a smaller assessment (18 candidates by default; compact, workload-sized output). Metadata-only records cannot supply evidence. Passage quote/provenance validation remains mandatory before outlining.
- Required named background queries join initial concurrent retrieval. One bounded gap-recovery round, up to three queries by default and at most two concurrent searches; essential evidence and explicit source requirements control stopping, not the three-per-part target. Recovery assesses only new sources.
- One section-structured draft with short request-local source aliases. The prompt carries the evidence once. Output compiles to the existing title/sections/content/reference contract.
- Deterministic checks, editorial review, and the existing independent claim/source-pair verification feed one repair budget. Normally this is passage patches; malformed initial output may use that same budget for one logged schema/registry repair, leaving no later repair. Unchanged content is preserved outside targeted patches.
- No post-draft source-search cascade, repeated length/prose rewrites or unconditional final review. Changed claims/context/evidence are reverified; final structure, coverage, source minimums, reference reconciliation, identity and CSL checks remain enforced.
- Incomplete/unknown results retain explicit status. Available drafts insert with a short review notice; the removed internal evidence report and raw JSON controls remain absent.
- Correlated stage timings, actual provider token usage/retries, cancellation/failure counts, candidate counts and repair counters. Missing usage remains unknown. Browser `essay:request-to-editor` performance entries measure insertion latency without essay text.

## Changed files

Backend: `Services/WorkbenchService.cs`, `WorkbenchService.CompactEssay.cs`, `EssayQuestionCoverage.cs`, `EssayQuestionCoverage.Compact.cs`, `CompactEssayPolicy.cs`, `EssayPipelineTelemetry.cs`, `ClaudeService.cs`; application `DTOs/Workbench/EssayQuestionCoverage.cs` and `WorkbenchDtos.cs`; `Tests/CompactEssayPipelineTests.cs`; `HumaniseAI.IntegrationTests/CompactEssayLiveComparisonTests.cs`; rollout/validation documentation. Local ignored appsettings files carry false in base configuration and true in Development; the code itself defaults the flag to false when absent.

Frontend: `src/components/app/WriteWithAiModal.tsx`, `src/lib/essayProgress.ts`, its tests, `src/types/workbench.ts`, and removal of the obsolete incomplete-review callback in `src/pages/app/DocumentEditorPage.tsx`.

## Automated validation

- 632 backend essay regression tests passed, including the full no-preview request, approved-plan reuse, initial essential queries, bounded assessment/recovery, provider failure, cancellation, one shared repair budget, unsupported citation pairs, source requirements, telemetry isolation, citation preservation and final section/reference consistency.
- 31 frontend stream/progress/citation/rendering tests passed.
- TypeScript and production frontend build passed. Backend/API/integration test projects compiled through the live harness.
- Existing unrelated nullable/analyzer and bundle-size warnings remain; no new test failures are left.

## Preliminary paired live comparison

One run per mode per topic, unchanged configured models, 750-word requests, identical frozen academic retrieval inputs within each pair, preparation cache disabled. Initial discovery is excluded from these clocks. Upstream verification caches are uncontrolled; baseline ran first. These observations predate the final writer-contract/recovery fixes and do not establish a validated speedup.

| Case | Mode | Seconds | Outcome | Words | Model calls | Input / output tokens |
|---|---|---:|---|---:|---:|---:|
| argumentative | baseline | 155.0 | failed | — | not recorded | not recorded / not recorded |
| argumentative | compact | 46.4 | Incomplete | 0 | 5 | 28600 / 8527 |
| empirical | baseline | 30.9 | Incomplete | 0 | 3 | 7448 / 6009 |
| empirical | compact | 35.7 | Incomplete | 0 | 6 | 25312 / 6062 |
| jurisdiction | baseline | 25.2 | Incomplete | 0 | 4 | 11113 / 4363 |
| jurisdiction | compact | 14.8 | Incomplete | 0 | 2 | 6808 / 2848 |

All six preliminary runs failed or remained incomplete. Short incomplete/empty responses are not successful low-latency generation. Positive scripted cases verify orchestration behavior, not real-world argument quality.

## Final-code focused live probe

The argumentative case was rerun after the writer reliability changes. This is one unpaired observation; its retrieval snapshot was rediscovered, so it cannot be treated as the final half of the earlier controlled pair.

- 755 words, 5 references from the retrieved source pool, 79.7 seconds of service execution using frozen retrieval inputs.
- Status: **Incomplete**. A schema repair used the one repair budget; later review/support findings correctly prevented completion.
- 11 recorded model calls; 78,631 input tokens, 25,889 output tokens, 1 provider retry. Provider usage was complete.
- The internal audit classified 59 evidence-requiring propositions: 47 supported, 8 unsupported and 4 uncited. This is the pipeline's own audit, not an independent quality score.
- Claim audit/support verification occupied 39.3 seconds, the largest observed stage. Draft-format repair occupied 8.8 seconds.

Across five harness invocations, ten generation attempts were recorded (six preliminary paired runs plus four focused reliability probes). Earlier focused probes rejected empty/unknown-source output; the last produced editable content while preserving the incomplete state. No verified-versus-verified latency improvement, median, tail latency or sub-minute generation claim is supported. Actual browser insertion latency and unrestricted live retrieval latency remain unmeasured; the browser instrumentation is ready for subsequent app runs.

## Rollout and rollback

`Workbench:CompactEssay:Enabled` / `Workbench__CompactEssay__Enabled` selects compact built-in orchestration. Production/base defaults to false; local Development is enabled for evaluation. Keep production rollout off until representative outputs meet the required quality standard. Setting the flag false restores legacy built-in orchestration without removing these files. Existing Python-runner selection is unchanged.

`VITE_ESSAY_LEGACY_PLANNING=true` restores the old frontend initial-plan request at build time. Backend rollback also accepts current clients that omit it. `Workbench:CompactEssay:RecoveryConcurrency` defaults to 2 and is clamped to 1–3; existing provider rate/retry protections remain in force.

The next measured bottleneck to investigate is claim audit/support verification, while preserving the independent support checks. Remaining model output and evidence gaps are explicit incomplete outcomes, not hidden validation success.

Deployment order: load/deploy the updated backend before the frontend, because it accepts plan-free essay requests. Restart the local API process if it is not using hot reload. No production deployment or user API-process restart was performed.
