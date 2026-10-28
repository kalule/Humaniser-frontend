# Academic writing blueprint: continuation, 22 October 2026

This audit describes the current local source and the changes in this continuation. The repositories already contain extensive uncommitted work; this is not a claim that all differences from Git HEAD were authored here. No deployed API, user document, production database or paid model generation was used for validation.

## Five-pillar audit

| Pillar | Existing implementation | This continuation | Remaining gap |
| --- | --- | --- | --- |
| Retrieval and scope | `WorkbenchService` builds anchored subtheme queries, assesses domain alignment, then uses `EssaySemanticReranker`. `SourceRecordExtractor` and `EssayEvidencePlanning` extract evidence and verify passages. | Added `EssayRetrievalScope` before reranking and removed the rejected-pool fallback. Added a typed scope path through the orchestrator and OpenAlex, including question-coverage follow-up retrieval. OpenAlex uses a native Education subfield filter and retains population constraints through query relaxation. | Other providers still need native taxonomy adapters; their returned title/abstract text is filtered before merging/ranking. Explicit tertiary/clinical/school rules do not provide arbitrary demographic inference. Persistent methodology/findings/conclusion chunks with full metadata are still needed. |
| Separate citations from generation | Existing backend/frontend deterministic formatters, internal source IDs, reference identity checks and finalization synchronization. | Co-writing now requests claim-level JSON, validates all IDs against passage permissions AND the session bibliography, then compiles tokens in code for the existing renderer. | Whole-essay/repair paths still use token-bearing prose. The subsequent [frontend CSL integration](academic-csl-integration-2026-10-23.md) adds citeproc-js for editor labels, structured bibliography rows and token previews; the [backend citation-library integration](academic-csl-backend-2026-10-23.md) now covers resolve/save/update and server DOCX export. The [whole-essay CSL integration](academic-essay-csl-2026-10-23.md) now adds ordered clusters, terminal compilation and selected-style scoring. Other document types and legacy formatting paths still require integration. Output currently uses plain text rather than rich typography. Verified page locators need a provenance field before they can be rendered. |
| Multi-pass pipeline | Question planning, retrieval, coverage assessment, evidence planning, outlining, section drafting, contract/style passes, verification, question review and finalization already exist. Co-writing intentionally follows the student's accepted section order. | Added an independent co-writing critic, one semantic repair and mandatory re-review before delivery, without replacing its public response contract. | The paths are not one uniform six-stage orchestrator. Legacy empirical-review drafting and co-writing have different contracts; those need deliberate consolidation rather than a second parallel pipeline. |
| Academic reviewer | `EssayOutlineDrafter` has guarded style and paragraph-repair passes. `EssayQuestionCoverage.ReviewAsync` reviews whole-essay answers; independent claim verification exists. | `EssayAcademicReviewer` checks the exact cleaned section for scope, support, tone, metadiscourse and nuance. Malformed/unavailable reviews or unresolved failures deliver no text. | The critic is a model judgment, not a deterministic entailment proof. Topic-appropriate counterarguments and context are checked against supplied evidence rather than inserting generic AI/ethics paragraphs. Scope is derived from the question; a separate writer-level field is not present in the cached co-writing session. |
| Cost and latency | `PipelineModelConfig` routes stages separately. Source records have distributed caching; evidence extraction has a bounded process cache; prepared co-writing evidence has user/request-scoped caching. Retrieval and some repair/review work are concurrent. | Added reusable paper document embeddings through `ICacheService`; cache misses alone are sent to the embedding API. | Body drafting remains sequential for continuity; the existing code records duplication problems with parallel drafting. Parallel drafting should be introduced only with distinct, locked paragraph obligations and semantic repetition checks. No cheaper model defaults or pricing assumptions were introduced. |

## Implemented code and behavior

Backend paths below are relative to `Humaniser/HumaniseAI.Infrastructure/`.

- `Services/EssayRetrievalScope.cs`: preserves explicit medical and school requests. For an explicitly tertiary question, candidates must identify a tertiary population in the title/abstract. School-only studies, unrelated clinical work and unspecified populations are excluded before embeddings. The student's qualification is not assumed to be the study population. This conservative policy can reduce recall; missing evidence is preferable to restoring rejected candidates.
- `Services/WorkbenchService.cs`: applies that scope filter in both initial retrieval branches and preserves an empty eligible set. Relaxing provider query syntax does not bypass these checks. This is not a guarantee that every other research feature, supplemental retrieval path or user-supplied source uses the same policy.
- `Services/EssayStructuredDraft.cs`: prompt contract and strict parser/compiler. Validates JSON shape, duplicate/unknown properties, field types, bounded claim/citation counts, nonempty prose, source syntax and exact permission membership. Rejects raw bracket markers and author/year parentheses in prose. Validation is atomic: an invalid later claim cannot leak earlier valid text.
- `Services/EssayCoWrite.cs`: uses the structured compiler, rejects stale passage/bibliography links before generation, retries malformed/unauthorized output once, and returns empty text plus a review message after repeated failure. The existing `Clean` helper remains for cleanup and its existing callers/tests; it is no longer the co-writing source-authorization boundary.
- `Services/EssaySemanticReranker.cs`: caches public paper document embeddings for 30 days with SHA-256 keys incorporating version, model, document role and the exact embedded text. Queries remain uncached. Missing, non-finite or dimension-mismatched vectors are recomputed. Cache failures do not prevent fresh embedding. Ranking ties preserve input order, and embedding failures retain the already-filtered candidates.
- `Services/VoyageEmbeddingClient.cs`: exposes its existing model constant internally so the cache identity follows the actual pinned model. Unknown embedding implementations do not get a guessed cache namespace.

The internal co-writing output schema is:

```json
{
  "claims": [
    {
      "paragraph_text": "Continuous assessment distributes evaluation across the semester.",
      "citations": [{ "source_id": "S1", "locator": null }]
    },
    {
      "paragraph_text": "Implementation therefore requires careful planning.",
      "citations": []
    }
  ]
}
```

Each entry is a consecutive sentence/clause in the section. Citations stay attached to that entry. `locator` may be omitted or null; non-null locators are rejected because current co-writing passages do not provide verified page numbers. The compiler produces `...semester [S1].` for existing deterministic rendering. No generated author/year string is trusted as bibliography metadata. The existing text-completion provider interface is unchanged: enforcement is prompt plus parser validation, not a provider-native JSON-schema guarantee.

## Follow-up integration: independent critic and native OpenAlex scope

- `Services/AcademicSearchScope.cs` keeps the original question and discipline separate from the provider search string. Optional capability interfaces avoid changing existing `ILiteratureOrchestrator`/`IOpenAlexProvider` signatures and their callers. The production implementations support these capabilities.
- `Services/LiteratureOrchestrator.cs` uses the scope for OpenAlex in both primary and enrichment roles. It also filters primary and supplementary candidate populations before selection/ranking. A missing scoped OpenAlex capability does not trigger an unrestricted OpenAlex request.
- `Services/OpenAlexProvider.cs` resolves the Education subfield by exact name through the taxonomy endpoint, caches that identity for 30 days, and adds `topics.subfield.id` to every relevant Works request. There is no hard-coded Education ID. Failure to resolve taxonomy sends no unfiltered Works request. Explicit clinical/medical requests avoid the Education-only restriction. The evidence-type year floor is preserved, including historical searches.
- The required tertiary-population search group is reapplied to every progressively relaxed OpenAlex candidate. Both Workbench structured-to-flat fallback and question-coverage recovery/background lookups carry the original scope. Ordinary and scoped provider caches are separate, and preparation-cache keys include a scope-policy version.
- Explicit school/tertiary comparisons now retain school-population studies for comparison instead of requiring every source to be tertiary. Text rules remain conservative heuristics; arbitrary demographic constraints and negated natural-language exceptions still require a richer explicit request schema.
- `Services/EssayAcademicReviewer.cs` is an independent read-only critic. It checks every claim/citation against supplied passages, domain/population fit, causal and numerical fidelity, academic tone, metadiscourse, and relevant qualifications/counterevidence. Workload, integrity, ethics and AI considerations are required only when relevant and supported. It reviews only generated text; student edits are context, not text to replace or evidence to trust.
- A critic must return all five boolean checks and a consistent list of failed check names. Missing, duplicate, contradictory, unknown or incorrectly typed fields cannot approve text. Raw model comments are never used as approval or exposed as repair instructions.
- `Services/EssayCoWrite.cs` cleans before review, permits one structured semantic repair, validates its sources again, and reviews the exact revised candidate. No later stage edits the approved text. An unavailable critic or unresolved failure returns empty text and a user-facing message; it does not fall back to the original draft. Conclusions now receive their source passages too, and citations are limited to sources actually supplied.
- Review calls use `Workbench:PipelineModels:AcademicReview`, defaulting to `Claude:Model` then the drafting model. Each review has a 45-second deadline and a 1,600-token allowance. A section permits at most two schema-generation attempts, two reviews and one repair (five calls maximum). The whole operation has a cooperative 165-second deadline, below the existing 180-second frontend request timeout. Caller cancellation propagates.

OpenAlex's [official topic documentation](https://help.openalex.org/data/topics/) documents hierarchy filters and the distinction between a primary-topic filter and matching any assigned topic. The implementation uses the latter for Education and resolves the taxonomy ID at runtime. The [subfields documentation](https://help.openalex.org/data/subfields/) describes the lookup/search endpoint. These are provider classifications, not proof that a paper supports a claim.

## Verification

- Infrastructure build: passed against existing Domain/Application binaries; 46 existing warnings, zero errors.
- Backend tests matching `FullyQualifiedName~Essay|FullyQualifiedName~OpenAlexQueryPlanner`: **348 passed**, zero failed/skipped. Includes structured-output rejection, exact claim/citation association, stale bibliography handling, critic approval/rejection/repair/cancellation, independent model routing, native filter persistence across relaxation, ordinary/scoped cache isolation, historical windows, primary/enrichment scope enforcement, embedding reuse and existing essay finalization tests.
- Latest logs: backend `artifacts/academic-review-build.log` and `artifacts/academic-review-tests.log`. Earlier increment logs remain under `academic-pipeline-*`.
- Frontend compatibility checks: **28 passed** across `EssayCoWritePanel.test.tsx`, `essayCoWrite.test.ts`, `generatedEssay.test.ts` and `useWriteWithAiStream.test.ts`.

The ordinary build initially attempted to write adjacent Domain build output outside the writable workspace. Reproduction uses the existing dependency binaries:

```powershell
# From HumaniseAI.Infrastructure
dotnet build HumaniseAI.Infrastructure.csproj --no-restore -p:BuildProjectReferences=false --verbosity quiet
dotnet test Tests/HumaniseV2.Tests.csproj --no-restore -p:BuildProjectReferences=false --filter "FullyQualifiedName~Essay|FullyQualifiedName~OpenAlexQueryPlanner" --logger "console;verbosity=normal"
```

Tests use deterministic fixtures and mocked model/embedding clients. They verify orchestration and validation, not the semantic accuracy or latency of a live model. No migration or deployment is included.

## Next integration boundaries

1. Extend native scope adapters beyond OpenAlex, including Semantic Scholar, Scopus and PubMed, and add explicit population/exclusion controls to the request schema. Preserve scope across every provider's query relaxation; do not assume a common Boolean syntax.
2. Persist passage chunks with source identity, section kind, exact text offsets, authors/year/journal/DOI/population, representation, text hash and embedding-model version. Do not infer page locators from abstract offsets.
3. Continue structured claims through remaining single-completion writers and whole-essay revision. The [structured answer repair integration](academic-structured-answer-2026-10-23.md) now covers answer-quality patches. The [structured passage repair integration](academic-structured-passage-2026-10-23.md) now covers existing-corpus, targeted and rewrite/remove patches. The [structured outline integration](academic-structured-outline-2026-10-23.md) now covers production outline sections, paragraph/verification repair and style editing, alongside existing co-writing. Revalidate after the final rewrite, then give a single citation renderer the verified bibliography and ordered citation clusters. The [2026-10-23 frontend CSL integration](academic-csl-integration-2026-10-23.md) now supplies a real processor for editor labels, structured bibliography rows and token previews. The [backend citation-library integration](academic-csl-backend-2026-10-23.md) also supplies metadata formatting and server DOCX export. The [whole-essay CSL integration](academic-essay-csl-2026-10-23.md) now covers ordered clusters, terminal compilation and selected-style scoring. Other legacy formatting views and rich typography remain separate integration work.
4. Evaluate the new critic on a representative live corpus and record false approvals/rejections and latency. Current mocked tests establish gating and data flow, not real model accuracy. Whole-essay and other document types still require their own verified review contracts.
5. Introduce bounded parallel body drafting only for outlines with distinct paragraph responsibilities and locked source mappings; preserve interactive student co-writing order.
