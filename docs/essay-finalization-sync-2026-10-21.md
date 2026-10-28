# Essay finalization synchronization fix

## Verified cause and data flow

`WorkbenchService.WriteWithAiCoreAsync` maintains prose (`content`) and a parsed section tuple. Its final citation-discipline call changed the prose and compiled references from the changed text without reparsing the tuple. Optional later revision and verification repair could also change citation IDs after the earlier identifier-consistency gate. `DocumentEditorPage.handleAiGenerated` preferred the returned sections, so the text validated by the backend could differ from the text inserted into the editor. `interactiveCitationTokens` preserved an unknown ID as its original display label.

The code defect is verified. There is no captured original generation response proving that this cleanup removed S45 in the screenshot.

The normal essay SSE and non-streaming controllers serialize the service response; they do not rebuild sections. The generation audit records outcome and flag codes, not a second copy of essay prose. The editor saves the actual TipTap JSON through `libraryStore.updateDocument` and `LibraryService.SaveDocumentAsync`; `LibraryDocument.Content` is opaque editor content. It does not retain a separate generated-content/sections pair. Thus older saved documents can retain the already-rendered stale citations, but there is no safe older prose field to restore over user edits.

## Changes

- Infrastructure `Services/WorkbenchService.cs`: reparse immediately after final citation cleanup. After optional revision/verification repair, finalize again from the latest content: normalize existing token syntax, apply existing citation discipline, remap canonical aliases, compile only cited references, parse with the existing section parser, and validate structure and citation/reference identity. This runs before the final editorial checks and before the outer audit write. Response content, sections, references and word count all use that finalized state; no subsequent stage rewrites the prose. If final text differs from the audited text, the claim audit is explicitly marked unavailable/stale.
- Infrastructure `Services/EssayCitationDiscipline.cs`: report sentences whose last internal source marker is removed. The service adds `CitationCleanupEvidenceRequired` review flags. Cleanup preserves the claim and ordinary author-date citations; it never invents a replacement source.
- Frontend `src/lib/generatedEssay.ts` and `src/pages/app/DocumentEditorPage.tsx`: validate the citation sequence and source resolution of a complete essay's content and sections before replacing the editor or changing its saved style. Render those finalized sections using the existing heading/paragraph behavior. Explicit partial-draft insertion remains available.
- Frontend `src/lib/editorCitations.ts`: missing internal IDs display as `[Citation needs review: S45]`, retaining the exact ID in citation data and preserving the claim. Existing academic citation labels remain intact. On JSON hydration, repair missing source snapshots only from the exact namespaced ID already present in that document's bibliography or another citation. No author/year guessing, external retrieval, prose replacement, or bulk migration. Display and Word export retain unresolved review labels.
- Infrastructure `Tests/EssayFinalizationTests.cs` and frontend `src/lib/generatedEssay.test.ts`: realistic fixtures cover stale S45 sections, serialization, valid citations, unknown IDs, canonical aliases, final validation ordering, section headings/paragraph formatting, export visibility, and compatibility that preserves user edits. Existing citation, library persistence, and writing-panel tests also run.

## Verification

- Backend focused finalization/co-writing/policy/quality tests: 139 passed; Infrastructure, Application and Domain built successfully. Existing unrelated nullable/analyzer warnings remain.
- All backend essay tests: 210 passed, 0 failed.
- Focused frontend rendering/citation/export/library/writing-panel tests: 39 passed, 0 failed.
- Full frontend suite: 535 passed, 3 failed (538 total, 68 files). Failures are in unchanged modules: two `essayReferenceQuality.test.ts` expectations for three-author and narrative formatting, and one `FixIssuesPanel.test.tsx` expectation for the label of `quality_br49`. These tests import unchanged formatter/reviewer code, not the new finalization or repair helper.
- TypeScript build check (`tsc -b`): passed on the final code.
- Vite production build: passed on the final code (3,979 modules transformed). Existing chunk-size and mixed dynamic/static import warnings remain.

## Remaining limits

Unknown metadata absent from an older saved document cannot be reconstructed safely. Such citations remain explicit review items requiring a real source or a claim revision. Loading a saved document never replaces user prose with a generated draft; repaired metadata follows the normal save path.

Under existing application policy, an uncited claim is a review warning rather than automatic proof of fabrication. The final question-coverage review can still return an incomplete draft for unsupported claims. If that semantic review is unavailable, the existing warning path remains; deterministic finalization guarantees representation/citation consistency, not semantic support for every claim. Last-marker removal is now reported rather than silently treated as a repaired claim.

No API contract or database schema changed. No live generation was purchased and no user document was modified to validate this fix.
