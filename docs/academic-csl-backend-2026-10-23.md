# Backend CSL citation integration — 2026-10-23

The .NET citation library service now formats structured metadata with a bundled citeproc-js worker. This supersedes the temporary cache-invalidation-only behavior in the [earlier integration notes](academic-csl-integration-2026-10-23.md).

The subsequent [whole-essay CSL compilation](academic-essay-csl-2026-10-23.md) adds ordered document clusters, a terminal essay formatting gate and selected-style revision scoring. It also records the resolved frontend test failure and newer verification results.

## Behavior

- Resolve still asks the existing Python runner for metadata, but its custom formatted strings are discarded. CSL generates all six response presets from that metadata.
- Save ignores caller-provided formatted strings and generates all six cache labels before persistence. A failed formatter prevents a new citation from being saved with unverified labels.
- Update formats the exact edited fields without another provider lookup. If formatting is unavailable, the metadata edit remains saveable with all labels cleared; old labels are never restored. Caller cancellation propagates. No-op updates preserve existing labels.
- Server DOCX export rebuilds the entire bibliography from saved metadata, preserving CSL sort order and year suffixes. It writes a real OOXML document directly, with hanging-indent paragraphs and literal plain text, bypassing the Python runner's lexical re-sort and asterisk interpretation. Numeric bibliography-only ordering follows library order, since no manuscript citation order exists.
- The API controller accepts all six presets and rejects unsupported styles with HTTP 400 instead of silently exporting APA. BibTeX remains the existing metadata exporter.

Infrastructure files are `Services/CslBibliographyFormatter.cs`, `Services/CitationBibliographyDocx.cs`, `Services/CitationService.cs`, `DependencyInjection.cs`, and the `CitationCsl/` bundle. The adjacent API change is in `Controllers/CitationController.cs`. Frontend/backend mappings also recognize the runner's native `journal` and `conference` item types.

## Runtime and resource bounds

The deployed API requires **Node 18 or later**, available as `node` or through `CitationCsl:NodeExecutable` (`CitationCsl__NodeExecutable` in environment variables). There is no runtime npm installation or external CSL service. This runtime prerequisite has not been installed or deployed to production by this change.

The project copies processor source, styles, locale, attribution and licenses into build/publish output. API build output was checked for the worker assets. The six CSL snapshots and US-English locale match the frontend bundle; source URLs and hashes remain in `CitationCsl/csl/assets-manifest.json`.

The .NET adapter passes JSON through stdin with shell execution disabled. It limits concurrency to two workers, the queue-plus-execution deadline to 30 seconds, Node heap to 256 MB per worker, record count to 500, requests to 2 MiB and responses to 4 MiB. Active subprocesses are killed on cancellation/failure. Output is validated for exact style coverage, source-index membership, uniqueness, entry count and nonempty labels. Worker errors do not print metadata. See Infrastructure `CitationCsl/README.md` for operating details.

## Verification

- Infrastructure build: passed, zero errors and 46 existing warnings, against existing Domain/Application binaries with `BuildProjectReferences=false`.
- API build: passed, zero warnings/errors; bundled worker assets present in API output.
- Backend citation selection: **36 passed**. Includes real Node/citeproc rendering, all six presets, whole-bibliography sorting/year suffixes, missing metadata, punctuation handling, invalid input, cancellation before launch, exact metadata edits, caller-label rejection, ownership checks, unavailable formatter handling, and real server DOCX generation.
- Frontend CSL regression selection: **49 passed** after aligning native runner item types. The earlier full frontend run had 606 passing tests and the existing unrelated reviewer-label failure; the full frontend suite was not rerun for this backend integration.
- Backend logs: `artifacts/csl-backend-build.log`, `artifacts/csl-api-build.log`, `artifacts/csl-backend-tests.log`, `artifacts/csl-backend-regression-tests.log`.

Tests inspect OOXML/text and processor behavior; they do not establish visual layout in Microsoft Word. No live metadata/model request or deployment was performed.

## Remaining work

Output remains plain text, without rich italic typography. The subsequent whole-essay integration connects ordered source-token clusters to the verified bibliography for terminal compilation and revision scoring; other document types and legacy harnesses retain separate renderers. Historical labels are not bulk-rewritten on library reads; current frontend views and exports reconstruct them from metadata. Persistent evidence chunks, additional provider-native scope adapters, live critic evaluation and bounded paragraph drafting remain tracked in the [pipeline audit](academic-pipeline-continuation-2026-10-22.md).
