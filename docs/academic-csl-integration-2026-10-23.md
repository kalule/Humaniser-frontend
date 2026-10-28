# Academic citation integration — 2026-10-23

The frontend editor and essay citation-token previews now use `citeproc` 2.4.63 with bundled CSL styles. Citation clusters and bibliography entries share a document registry, so first-use numbering, bibliography order and same-year disambiguation remain synchronized after editing. This completes the frontend CSL adapter portion of the [pipeline audit](academic-pipeline-continuation-2026-10-22.md), not the entire implementation blueprint.

The subsequent [backend CSL integration](academic-csl-backend-2026-10-23.md) adds the citation-library service, structured metadata formatting and server DOCX rendering. Its runtime requirements and verification supersede the temporary backend limitations recorded in the chronological follow-ups below.

## Implementation

- `src/lib/csl/render.ts` validates source identities, citation groups and locators before rendering. Each uncached document gets an independent processor; a bounded cache stores completed results only. Canonical cluster identities permit cache reuse after ordinary prose edits without leaking state between documents.
- `src/lib/csl/tokens.ts` resolves internal source tokens through that renderer. Narrative citations require explicit `[N:S1]` tokens. Unknown or mixed unresolved groups remain visible as citation-review markers instead of silently losing sources.
- `src/lib/editorCitations.ts` refreshes citation labels and structured reference rows together. It preserves raw legacy reference rows and ordinary prose, reordering only contiguous structured bibliography rows. Uncited sources cannot take numbers ahead of cited sources. Invalid locators and mismatched source snapshots require review.
- `src/lib/citationFormat.ts` maps supplied author metadata conservatively, preserving structured names and recognizable corporate authors. Missing authors, dates and page locators are not invented.
- `src/lib/essayCitationTokens.ts` shares the CSL renderer with editor imports and previews. Other standalone citation views still have legacy formatting paths.

Bundled presets are APA 7; Cite Them Right 12 (Harvard); IEEE Reference Guide 11.29.2023; MLA Handbook 9; Chicago 18 author-date; and NLM/Vancouver Citing Medicine 2, citation-sequence. Rendering currently uses English (United States).

The XML snapshots and hashes are recorded in `src/lib/csl/assets-manifest.json`. Source URLs identify upstream download locations, not immutable Git commits. Public copies, original processor notices, license texts and unmodified processor source are under `public/licenses/`; `/licenses/citation-formatting.txt` describes them. Rendering runs locally and makes no upstream requests.

## Verification

- `npm run build`: passed, including TypeScript and Vite. Existing mixed-import and large-chunk warnings remain; the processor and bundled styles add frontend bundle weight.
- Full frontend suite: **565 passed, 1 failed**, across 71 files. All citation tests passed, including document numbering, retroactive year suffixes, grouped narratives, metadata handling, invalid-source guards, bibliography ordering, cache isolation and editor undo/redo.
- The remaining failure is outside this change: `FixIssuesPanel.test.tsx:85` expects `Reference diversity`, while the current label is `Source concentration`. That label/test was left unchanged.
- Logs: `artifacts/csl-build.log` and `artifacts/csl-full-tests.log`. Backend tests were not rerun for this frontend increment; earlier backend results remain in the pipeline audit.

## Remaining boundaries

### Follow-up: server metadata edits and legacy export guards

Infrastructure `CitationService.UpdateAsync` no longer re-resolves a DOI (or mistakenly sends a title as a DOI) after saving metadata edits. That lookup formatted provider metadata instead of the edited record and could overwrite cache labels with a different title/year/author representation. A real metadata change now invalidates all six cached labels; no-op edits retain them. Frontend CSL views and local DOCX export continue rendering the current metadata without requiring those caches.

Legacy server DOCX export rejects missing/blank selected-style labels before invoking the runner, rather than producing a partial bibliography. The service validates all six style identifiers; the existing API controller's four-style whitelist is still a separate limitation. BibTeX shares the exact saved-metadata mapping and remains available after invalidation. This change does not add a backend CSL processor or a cache-provenance migration for historical records. Existing update-request null semantics remain unchanged.

The Infrastructure build passed with zero errors and 46 existing warnings, using `BuildProjectReferences=false` and existing Domain/Application binaries. All **11** new database-backed tests passed, covering invalidation, no-op edits, ownership checks, export rejection, edited BibTeX metadata and all six service-level styles. The broader citation regression selection passed **29 tests**. Logs are under Infrastructure `artifacts/citation-metadata-build.log`, `artifacts/citation-metadata-tests.log` and `artifacts/citation-regression-tests.log`.

### Follow-up: Citation Generator DOCX download

`useCitation.exportDocx` now lazy-loads `src/lib/csl/citationDocx.ts` and downloads a real OOXML `.docx` generated from the current library metadata. All entries share one CSL registry for sorting and year-suffix disambiguation. Numeric bibliography-only exports use supplied library order because no manuscript citation order exists. Reference paragraphs have hanging indents; text remains plain CSL output without rich emphasis.

This replaces the Generator's server DOCX call, which read cached labels and whose controller accepted only four of the six displayed styles. Existing server endpoints are unchanged; direct API consumers still have that limitation. BibTeX remains the existing server metadata export and does not use CSL style rendering.

JSZip 3.10.1, already present transitively, is now an exact direct dependency. Tests inspect the OOXML archive and extract text using Mammoth for all six presets, confirm escaping and hanging-indent properties, exercise whole-bibliography sorting/disambiguation, and reject empty, duplicate or invalid source identities before download. These are structural and text round-trip checks, not visual verification in Microsoft Word.

Focused export/record tests: **18 passed**. Full frontend suite: **606 passed, 1 failed** across 74 files; the sole failure remains the existing reviewer-label mismatch. Logs: `artifacts/csl-docx-tests.log` and `artifacts/csl-docx-build.log`.

### Follow-up: Citation Generator

`CitationPage` now uses `src/lib/csl/citationRecord.ts` to render resolved and saved records from structured metadata. Display and clipboard actions no longer trust stale server-formatted strings or require a cached format to exist. Failed rendering shows a review message and disables copying. CSL plain text is displayed literally, preserving asterisks in titles rather than interpreting them as server italic markers.

New saves contain all six CSL-rendered cache fields while preserving the existing API request shape. The editor uses the same record-to-CSL metadata mapper, including separate publisher/container fields and exact structured author names. Existing records are not rewritten merely by viewing them. The subsequent DOCX download integration is described above; BibTeX still uses the server.

Focused tests: **44 passed**. Full frontend suite: **598 passed, 1 failed** across 73 files; the sole failure remains the existing `FixIssuesPanel` label mismatch. Logs: `artifacts/csl-generator-tests.log` and `artifacts/csl-generator-build.log`.

### Follow-up: Web Library citation previews

`CitePopover` now renders its in-text and reference previews through the shared CSL registry using `src/lib/csl/paperCitation.ts`. All six presets, including MLA, are available. Processing starts only when the popover opens; invalid metadata shows a review message and disables copying. Numeric previews start at one independently; document insertion must still recalculate numbering and disambiguation in full context.

The shared CSL author mapper now honors explicit semicolon boundaries, preserving both full-name authors and surname-first authors instead of collapsing them into one person. Unstructured comma-only lists remain conservative. Focused regression coverage: **120 passed** across six files, including all presets, corporate authors, missing metadata, author boundaries, invalid previews and document transactions.

The follow-up full frontend suite reports **588 passed, 1 failed** across 72 files. The sole failure remains the existing `FixIssuesPanel` label expectation described above. Full-suite output is in `artifacts/csl-library-tests.log`; production-build output is in `artifacts/csl-library-build.log`.

### Follow-up: imported publication metadata

Library-to-editor imports now preserve publisher separately from journal/container title. Item types accept case and separator variations such as `Book`, `BookChapter`, `journal_article` and `article-journal`, while unsupported types retain the existing conservative fallback. This prevents book publishers from being treated as journals and preserves publisher output in CSL bibliography rows. Regression coverage includes an imported book rendered through the editor transaction and item-type normalization. Focused citation/editor/generated-essay tests and TypeScript were rerun for this follow-up; the full-suite result above belongs to the preceding integration run.

CSL output is currently plain text and does not provide rich italic typography. Editor exports consume stored labels; the citation-library backend now has a CSL implementation, while backend essay compilation and other document types still need integration and their own fixtures. Legacy standalone formatters remain in other views and initial insertion paths.

The broader blueprint still requires structured claims through every generation/repair path, persistent provenance-bearing evidence chunks, native scope adapters beyond OpenAlex, live critic evaluation, and bounded parallel drafting with locked paragraph/source obligations. No deployment or live model evaluation was performed in this increment.
