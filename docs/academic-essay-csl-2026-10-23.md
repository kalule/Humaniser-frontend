# Whole-essay CSL compilation — 2026-10-23

Backend whole-essay generation now checks final citation rendering against the verified session bibliography before reporting completion. The editable response keeps its canonical `[S#]` tokens and source metadata for the frontend. Revision scoring receives a document rendered with the requested CSL style, replacing the previous always-Harvard scoring path.

## Implementation

- Infrastructure `EssayCslCompiler` accepts exact source IDs, grouped citations and explicit `[N:S#]` narratives. Mixed unknown groups, malformed tokens, duplicate bibliography IDs and unsupported styles reject the whole compilation before launching the processor. It adds no citation locators from publication page ranges.
- The bundled worker and `ICslDocumentFormatter` process ordered citation clusters through one citeproc-js registry. Retroactive year suffixes, bibliography sorting, numeric first-use order and grouped narratives stay synchronized. Uncited sources are excluded from the document bibliography and reserve no numbers. Adapter output must contain exactly the requested clusters and cited source indices.
- `WorkbenchService` runs a terminal formatting gate after finalization and evidence/review checks. Failure returns an incomplete draft requiring review; it cannot mark a document complete with unrenderable citations. This gate does not rewrite the final prose or replace source tokens in the API contract.
- `EssayRevisionLoop` uses asynchronous CSL rendering with the selected style. `RenderableReference` carries full structured authors, publisher, URL and item type through production scoring; legacy callers can continue supplying surname/initial metadata. The synchronous Harvard renderer remains for existing fixtures and comparison harnesses, while product scoring uses CSL.
- Author mapping preserves structured families/given names and literal organizations. Explicit semicolons preserve author boundaries; ambiguous unstructured names remain literal. No authors, publication years or page locators are invented.

The worker keeps the runtime, concurrency, process and input/output bounds described in the [backend CSL notes](academic-csl-backend-2026-10-23.md). Node 18+ remains a deployment prerequisite. Document requests permit at most 1,000 clusters and 20 source indices per cluster. These are plain-text citations; rich typography remains separate work.

## Reviewer test correction

The frontend BR49 test now expects `Source concentration`, matching both the current implementation and `Humaniser/docs/specs/business-rules.md`. BR49 is an advisory concentration rule, so changing the expectation preserves the specified product behavior.

## Verification

- Backend essay/citation/OpenAlex regression selection: **391 passed**. Includes real processor tests for all six citation styles, document numbering, year suffixes, narrative groups, unknown/malformed tokens, metadata preservation, existing finalization and citation-library regressions.
- Full frontend suite: **609 passed**, 74 files, exit status zero. The earlier reviewer-label failure is resolved. Node emits an existing `--localstorage-file` environment warning; it does not fail the tests.
- Infrastructure build: passed, zero errors and 46 existing warnings. API build: passed. Builds use existing Domain/Application binaries with `BuildProjectReferences=false`.
- Logs: Infrastructure `artifacts/essay-csl-build.log`, `artifacts/essay-csl-api-build.log`, `artifacts/essay-csl-tests.log`; frontend `artifacts/outstanding-frontend-tests.log`.

Verification uses deterministic fixtures and real local citeproc rendering; it does not consume model quota or establish live critic accuracy. No deployment was performed.

## Remaining blueprint work

### Follow-up: interactive co-writing delivery

`EssayCoWrite.DraftAsync` now uses the configured document formatter after the independent critic approves the candidate. It checks only the candidate's cited session metadata with the selected style; accepted student text remains context and is not rewritten or searched for guessed source IDs. Invalid or unavailable formatting returns no text, source IDs or evidence IDs. Duplicate session source IDs are rejected before model generation. Caller cancellation still propagates, and compilation stays within the existing 165-second operation deadline.

The response retains the exact critic-approved prose and canonical source tokens. Labels are checked locally but document-wide numbering and suffixes are still recalculated in the editor's full context. Introductory prose with no citations requires no processor invocation.

The follow-up Infrastructure build passed with 46 existing warnings and no errors; API build passed. Focused co-writing/reviewer/compiler tests: **45 passed**; broader essay/citation/OpenAlex regression selection: **395 passed**. Logs: Infrastructure `artifacts/cowrite-csl-build.log`, `artifacts/cowrite-csl-tests.log`, `artifacts/cowrite-csl-api-build.log` and `artifacts/cowrite-csl-regression-tests.log`. No frontend code changed in this follow-up; the preceding full frontend result remains 609 passing tests.

Whole-essay writers and repair paths still need structured claim JSON throughout; interactive co-writing already validates that contract but retains its own delivery flow. Evidence chunks still need persistent section/provenance metadata and verified locators. Provider-native scope adapters beyond OpenAlex, live critic evaluation and bounded parallel paragraph drafting remain in the [pipeline audit](academic-pipeline-continuation-2026-10-22.md). Those are separate changes from citation rendering and the now-resolved frontend test failure.

The subsequent [structured outline integration](academic-structured-outline-2026-10-23.md) migrates production outline sections, paragraph/verification repairs and style rewrites to the same claims contract. It documents the remaining single-completion and patch-based paths separately.
