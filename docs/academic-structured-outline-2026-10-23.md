# Structured outline drafting and repair — 2026-10-23

The production outline-based section drafter now requests claim JSON instead of inline citation prose. Paragraph repair, verification repair and style editing on that path also validate structured claims before applying replacements. This extends the existing co-writing contract without changing the editor's canonical source-token response format.

## Behavior

- `WorkbenchService` explicitly enables structured output for `EssaySectionDrafter`, outline conformance and verification repairs. Older direct test/comparison callers retain their plain-prose compatibility mode.
- Each section call uses `EssayStructuredDraft.Contract`. The parser validates the entire claims array and exact source permissions before compiling tokens. Raw brackets, author/year citation strings, non-null unverified locators and source IDs written as prose are rejected.
- Body paragraphs receive only their assigned source records. Missing or invalid assigned IDs fail before generation. The introduction cites nothing; synthesis, evidence quality and conclusion may cite only sources actually used in the body.
- A malformed section gets one retry and then fails without falling back to raw inline-citation output. Layout is assembled in code. Body drafting remains sequential for continuity; synthesis and evidence-quality calls remain concurrent and are both awaited even if one fails.
- Paragraph repairs retain their existing maximum of three attempts, source permissions, word/number guards and atomic application rules. Invalid structured output cannot replace the original paragraph. Production repairs include the allowed source records.
- Style rewrites can use only the original paragraph's source IDs, and the existing guard still requires the same citation multiplicities. Invalid JSON or new sources leave the original text intact. Structured repair/style token allowances include JSON overhead; legacy allowances remain unchanged.
- A broken layout in structured conformance retries section-by-section with the same contract rather than requesting raw whole-essay prose.

Relevant Infrastructure files: `EssaySectionDrafter.cs`, `EssayStructuredDraft.cs`, `EssayDraftContract.cs`, `EssayOutlineDrafter.cs`, `EssayVerificationRepair.cs`, and `WorkbenchService.cs`.

## Verification

- Infrastructure build: passed with zero errors and 46 existing warnings, against existing Domain/Application binaries with `BuildProjectReferences=false`.
- Focused section-drafting, essay-quality and co-writing selection: **110 passed**. Includes scoped record payloads, cross-section source rejection and retry, repeated invalid output, missing assigned records, plain-source-ID rejection, repair fallback to the original, and authorized/unauthorized structured style rewrites.
- Broader essay/citation/OpenAlex selection: **404 passed**. API build passed with zero warnings/errors.
- Logs: Infrastructure `artifacts/structured-outline-build.log`, `artifacts/structured-outline-focused-tests.log`, `artifacts/structured-outline-regression-tests.log`, `artifacts/structured-outline-api-build.log`.

Tests use deterministic model fixtures; no live model calls or deployment were performed. No frontend runtime code changed; its preceding full result remains 609 passing tests.

## Remaining boundaries

This covers the outline-based section path, not every Workbench writer. The configured single-completion mode, excerpt/question-coverage fallback writers, general patch-based claim repairs and the optional full-essay revision agent retain their separate output contracts. They still pass final source validation and CSL compilation, but need migration to structured claims throughout. JSON validation establishes source membership and syntax, not entailment; existing evidence audits and critics remain necessary. Persistent evidence chunks, provider-native scope adapters beyond OpenAlex, live critic evaluation and bounded parallel body drafting remain in the broader [pipeline audit](academic-pipeline-continuation-2026-10-22.md).

The subsequent [structured passage repair integration](academic-structured-passage-2026-10-23.md) migrates the existing-corpus, targeted and final rewrite/remove claim-repair rounds. It records their atomic patch validation and per-passage source permissions separately from the remaining answer-quality and whole-essay writers.
