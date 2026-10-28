# Reference analysis and adaptation

Reference inspected: `C:/Users/42153/OneDrive/Desktop/Botho/company/robust-lit-review`.
That repository has no `.codegraph/` index, so its source was inspected directly.
It is MIT-licensed, copyright 2026 Hsieh-Ting Lin. The implementation here is a new
topic-neutral adaptation of its architecture, rather than importing its CLI runtime.

## What the reference actually does

| Reference module | Observed pattern | Adaptation |
|---|---|---|
| `models.py` | Pydantic article/query/statistics/output records | Strict request/response and intermediate DTOs in `models.py` |
| `pipeline/orchestrator.py` | Constructor-injected provider clients, async lifecycle, parallel searches, deduplication, quality filters and statistics | Injected shared HTTP/LLM dependencies; async request-local orchestration in `service.py` |
| `clients/openalex.py` | Async metadata enrichment and bounded concurrent journal lookups | Authenticated OpenAlex search using existing appsettings, bounded HTTP requests and original abstract reconstruction |
| `pipeline/filters.py` | Explicit date inclusion/exclusion | Inclusive date filters with reasons; unknown years excluded only when date bounds require them |
| `pipeline/semantic_selector.py` | Embedding pre-ranking plus LLM inclusion judge | LLM abstract relevance screening and balanced subtopic selection, without new heavyweight model downloads |
| `pipeline/llm_extraction.py` | Structured abstract extraction; absent information stays empty | Nullable methods fields and original passage IDs for extracted findings and limitations |
| `pipeline/review_writer.py` | Thematic comparison and structured article context | Schema-bound synthesis followed by server-owned citation rendering and real methodology reporting |
| `utils/llm.py` | Prompts and JSON files dispatched to external Claude Code agents | Direct injected async model calls with validated JSON and one retry; no external-agent dependency |
| `pipeline/crosscheck.py` | Independent evidence checking as a separate stage | Existing claim auditor reused to expose unverified/unsupported synthesis claims |

The reference's main topic orchestrator primarily retrieves Scopus, PubMed and Embase;
its OpenAlex client supplies enrichment. The current project already has working OpenAlex
credentials and Crossref integration, so those providers form the new endpoint's retrieval
layer. Provider selection and execution traces are explicit. Scopus/PubMed/Embase,
Unpaywall, Zotero and manuscript export are not claimed as implemented here.

## Important changes from the reference

- Some reference writer prompts hard-code a clinical query, publication years and provider
  names. This API renders methodology from actual request/execution data instead.
- Citation counts are not used as a fallback proxy for relevance, and no Q1/CiteScore or
  risk-of-bias ratings are inferred when the metrics are unavailable.
- The reference can truncate abstracts before model calls and use permissive JSON parsing.
  This adaptation preserves bounded full abstracts, uses strict schemas, validates complete
  screening IDs and binds extraction/synthesis to server-owned original passages.
- External subagent task dispatch and file-based checkpoints are not suitable HTTP request
  dependencies. Async services, bounded concurrency, correlation logs and explicit failure
  responses replace that execution mechanism.
- The reference advertises PRISMA audit/manuscript publishing workflows. This API exposes
  honest bounded-search counts and an evidence matrix without certifying systematic-review
  completeness, publication readiness or an academic grade.
- Provider failure does not silently become success: partial coverage is returned as a
  warning; complete provider failure returns 503. Insufficient evidence returns 424.

## File map

- `models.py`: request validation, metadata, extraction, synthesis, methods and response DTOs.
- `retrieval.py`: provider adapters, parsing, deduplication, deterministic filters, DOI checks.
- `prompts.py`: topic-neutral screening, extraction and synthesis instructions.
- `synthesis.py`: schema parsing/retries, evidence bindings, balanced selection and model calls.
- `serialization.py`: APA citations, narrative rendering and actual methods summary.
- `service.py`: orchestration, deadlines, stage logs, statistics and claim-audit integration.
- `dependencies.py`: FastAPI dependency lookup and test override boundary.
- `diagnostics.py`: request-local validation correlation, allowed-ID schema constraints
  and specific repair feedback without logging model content or credentials.
- `router.py`: dedicated POST handler, shared concurrency budget and OpenAPI annotations.
- `../main.py`: lifespan registration and model-provider integration.
- `../test_literature_review.py`: provider, validation, evidence, service and route regressions.

The reference directory is read-only input to this work and is not modified.
