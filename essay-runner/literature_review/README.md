# Literature review API

`POST http://127.0.0.1:8007/v1/literature-reviews/generate`

Interactive documentation is at `http://127.0.0.1:8007/docs`, under **Literature reviews**.
Uses Python 3.11+, the existing FastAPI service, its configured OpenAI-compatible model,
and the existing `Literature.OpenAlexApiKey`, `OpenAlexEnabled` and `PoliteEmail` appsettings.
No new dependency installation or separate Python process is required.

```json
{
  "topic": "Generative AI and assessment design in higher education",
  "query": "generative AI assessment higher education",
  "search": {
    "providers": ["openalex", "crossref"],
    "queries": ["generative AI assessment higher education"],
    "year_from": 2020,
    "year_to": 2026,
    "verify_dois": true
  },
  "domain_filters": ["higher education"],
  "max_papers": 8,
  "min_papers": 3,
  "target_words": 1500,
  "verify_claims": true
}
```

At least one of `topic` or `query` is required. When both are supplied, `topic` defines
the review question and `query` the default retrieval string. Explicit `search.queries`
override that retrieval string. Subject-domain filters are enforced by the abstract
screening model; they are not website hostnames or formal taxonomy IDs. Defaults search
OpenAlex and Crossref. Maximum 3 queries, 20 papers, 5 subject constraints and 4,000 target
words; `min_papers` must not exceed `max_papers`. Search years are inclusive.

## Pipeline and response

1. Search configured providers concurrently (4 network slots, 25-second search timeout).
2. Normalize metadata, DOI URLs, authors, Crossref JATS and OpenAlex inverted abstracts.
3. Deduplicate by normalized DOI and author/title/year identity. Detect preprint/publication
   pairs using explicit relationships or matching authors, close publication years, similar
   titles and >=0.8 Jaccard overlap of five-word abstract shingles. Prefer published versions;
   retain alternate-version provenance. Assign canonical IDs before extraction or auditing.
4. Exclude unusable abstracts, requested year mismatches, datasets, peer-review comments,
   retractions and similar records. Rank all eligible candidates with local TF-IDF similarity
   and question-concept coverage BEFORE the bounded screening budget (12-60 candidates).
   Record ranking scores and all unscreened records; retrieval order only breaks ties.
5. Screen relevance against the actual question and subject constraints, with explicit
   inclusion reasons and a 0–4 score. Inclusion requires >=3. No journal metrics are guessed.
6. Optionally verify eligible DOI metadata in Crossref, excluding title mismatches before
   final selection. Crossref 404 means *not indexed in Crossref*, not an invalid DOI.
7. Select across model-assigned subtopics in round-robin order, ranked by relevance within
   each subtopic. Return 424 when too few usable sources remain; do not add filler.
8. Extract structured methods, sample/population, findings, reported limitations and
   author-stated gaps, evidence type and supported setting information. Abstract-omission
   diagnostics are kept out of synthesis inputs. Publication type and study design remain
   separate dimensions. Extraction runs with 3 shared LLM slots. Passage IDs
   refer to original server-owned text, and cannot point into another source.
9. Synthesize themes, methodological comparisons, contradictions and corpus-specific gaps.
   The model selects evidence passage IDs; the server derives source IDs from their
   validated owners, preventing redundant model citation lists from disagreeing with
   selected evidence. All returned blocks have known source IDs and matching passage IDs. A declared
   contradiction needs at least two distinct sources. An optional proposed contradiction
   backed by only one source is omitted and recorded in `synthesis.validation_warnings`;
   the overall result is marked `needs_review`. No second citation is fabricated. Unknown
   evidence IDs in review paragraphs still fail validation. The server formats citations
   and actual methods.
10. Render scope, actual search failures and budget limits, evidence counts, a study table,
    thematic comparison, gaps, conclusion and references. Author-year collisions receive
    deterministic suffixes shared by prose, bibliography and audit matching.
11. Audit ONLY synthesized narrative, not extracted key findings, methods counts, table or
    references. Audit each sentence-source pair. Supported results require 1-15 verbatim
    words from a passage owned by the cited source; whitespace alone is normalized.
    Invalid quotations trigger one retry, then become unverifiable issues, never support.
    Pair coverage/schema errors still fail after retry. Record distinct sentence and pair counts.
12. Perform at most one evidence-grounded synthesis repair and re-audit the final text.
    Outstanding audit issues, incomplete searches or screening-budget limits prevent a
    verified run from being labelled passed. There is no automatic publication step.

The typed response includes:

| Field | Contents |
|---|---|
| `request_id` | Correlation ID, also in `X-Request-ID` |
| `summary` | Cited summary |
| `key_findings` | Findings with paper IDs and supporting passage IDs |
| `papers` | Metadata, provider provenance, DOI status, extraction and original passages |
| `citations` | Server-generated plain APA references for sources used by synthesis |
| `synthesis` | Typed sections, source/passage bindings, comparisons, gaps and contradictions |
| `synthesized_review_text` | Markdown review, actual search-method summary and bibliography |
| `methodology` | Actual search runs, counts, inclusion/exclusion reasons and scope limitations |
| `quality_checks` | Binding status, uncited included papers and claim-audit results |
| `warnings` | Partial provider failures, uncertain DOI metadata and length issues |

`word_count` counts cited narrative text, excluding the bibliography and server-generated
search methods. Target length is approximate. All selected papers remain available in the
evidence matrix, while unused papers are excluded from synthesis references and flagged.

This is an **abstract-based rapid narrative review**, not a comprehensive systematic
review. Search counts describe retrieved parsed records, not all records in each index.
The workflow does not perform full-text screening, independent dual screening, GRADE,
journal-quartile verification, or formal risk-of-bias appraisal. Relevance and audit labels
are model assessments. Valid passage bindings establish identity, not semantic entailment.

## Integration and failure behavior

`main.py` registers the router and initializes the retriever, synthesizer and orchestrator
in FastAPI lifespan. `get_literature_review_service` exposes a normal `Depends` boundary
for dependency overrides. The HTTP client and generation semaphore are shared with the
existing essay endpoints. No changes are required in the sibling .NET application.

The whole request has a 300-second deadline. Provider failures preserve other successful
searches and generate warnings. Model schemas include the actual allowed paper and passage
IDs. Validation retries receive the previous response and specific field/binding errors,
not only a generic instruction. Extraction/model schema and evidence-ID failures get one
validation retry. A paper still failing extraction is excluded explicitly; synthesis uses
only successful papers and only if `min_papers` is still satisfied. Such partial runs are
marked `needs_review`. Too few successfully extracted papers return 502 with code
`review_extraction_failed`. Persistent screening/synthesis failures return 502 with code
`review_model_validation_failed`, `stage`, `model_schema`, and safe `validation_errors`.
Concurrent extraction tasks finish or cancel with the request; failed evidence is never
used or silently treated as verified. Structured JSON logs contain stage, correlation ID,
counts, duration and safe error type; credentials, source content, query text and raw
provider exceptions are not logged.
The startup script retains server logs under `essay-runner/logs/` (Git-ignored) so an
`X-Request-ID` can be traced after a failed Swagger request.

| HTTP | Meaning |
|---|---|
| 422 | Invalid input |
| 424 | Insufficient usable relevant evidence; exclusions and search traces included |
| 429 | Shared generation budget busy; `Retry-After: 2` |
| 502 | Upstream model output/schema/evidence-binding failure |
| 503 | Missing model configuration or no selected provider succeeded |
| 504 | Upstream or overall deadline exceeded |
| 500 | Unexpected sanitized pipeline failure |

Run `python -B -m unittest -v test_literature_review` for the dedicated tests, or
`python -B -m unittest discover -q` for all Python service tests. Route tests use dependency
overrides; provider/model tests use mocked HTTP/LLM boundaries, with no billable requests.

See [REFERENCE_ANALYSIS.md](REFERENCE_ANALYSIS.md) for the reference-code analysis and file map.
