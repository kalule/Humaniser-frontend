# Root Cause & Remediation Report: Citation Integrity Incidents

## Executive conclusion

The incidents indicate three distinct control failures, not one retrieval-quality problem:

1. **Source identity was not preserved end to end.** Claims were apparently allowed to cite author/year text rather than immutable source IDs. This permits both retrieval collisions and generation-time substitutions.
2. **Generation was not fail-closed.** Orphan author/year strings and `[CITATION NEEDED]` survived into manuscript output, which means the final validator was absent, advisory, or bypassable.
3. **Coverage was measured as citation quantity rather than claim/evidence coverage.** Reuse of five or six qualitative-method sources across Sections 4–6 is consistent with a small, weakly filtered candidate pool being repeatedly passed to the model.

The supplied manuscript is sufficient to classify symptoms, but not to prove the precise stage that introduced each author. The decisive test is whether each cited source ID appears in the retrieval pool and prompt-context snapshots. The logging protocol below makes that distinction deterministic.

## 1. Anomaly-to-failure matrix

| Anomaly | Primary failure mode | Contributing mode(s) | Most likely mechanism | Decisive evidence |
|---|---|---|---|---|
| `(Shao, 2029)` absent from references | **C — hallucinated grounding** | D, B | Free-form author/year generation created an unbound citation. A bad future-date parse is an alternative only if a Shao record is present upstream. | If absent from prompt sources: C. If present with parsed year 2029: D, then B. |
| `(Li, 2028)` absent from references | **C — hallucinated grounding** | D, B | Same pattern; author/year was not constrained to a source registry and no bibliography cross-check blocked output. | Search retrieval and prompt snapshots for the exact source ID/author/year tuple. |
| Zhang 2026 used for CNS-delivery bibliometrics | **A — semantic collision** | B, C | Generic scientific terms matched an RNA/mitoxantrone paper; missing domain/entity gates allowed passage and the model attached it to a claim. | Zhang record in Top-N plus high reranker score confirms A/B; absent record confirms C. |
| Santos 2026 used for graph brain-bioavailability prediction | **A — semantic collision** | B, C | “Multimodal”, “prediction”, or biological terms dominated similarity while target entities and task type were not enforced. | Query, dense/BM25 component scores, reranker features, and prompt source IDs. |
| Li 2026 used for Bayesian population heterogeneity | **A — semantic collision** | B, C | “Hierarchical”, “population”, or “heterogeneity” produced cross-domain similarity to food/biomaterial content. | Claim–abstract score and domain/entity-match features. |
| Wang 2026 used for paediatric/ICU population PK | **A — semantic collision** | B, C | Biomedical vocabulary yielded a false positive despite absence of PK, paediatric, or ICU concepts. | Candidate pool and hard-field/filter decisions. |
| Rashid 2026 used for regulatory precedent/feasibility | **B — unconstrained pass-through** | A, C | A computational-screening paper cannot support a regulatory-precedent claim; even moderate semantic similarity should have been rejected by claim-type and domain checks. | Filter audit showing no regulatory-document/source-type requirement. |
| Raw `[CITATION NEEDED]` in Sections 1 and 5.1 | **E — fallback/termination failure** | C, prompt/output validation | Zero-hit or low-confidence retrieval ended without a retry; the placeholder was accepted as valid final text. | Query attempt chain, stop reason, fallback events, and final validation result. |
| Sections 4–6 recycle 5–6 qualitative-method citations | **B — candidate-pool bottleneck** | A, query transformation, coverage policy | Section-specific queries/corpora were missing or generic, and diversity/claim coverage constraints did not prevent repeated pass-through. | Per-section query traces, unique source count, citation frequency, claim coverage, and reranker pool overlap. |

### Causality caution

An author/topic mismatch visible only in final prose cannot by itself distinguish A/B from C. If the incorrect paper was in the prompt, retrieval/filtering failed; if it was not, generation grounding failed. Future years likewise implicate D only when the malformed date exists in raw/normalized metadata. Otherwise they are generation hallucinations.

## 2. Root-cause analysis by anomaly group

### 2.1 Phantom/orphan and future-dated citations

The direct control failure is referential: an in-text citation was emitted without a valid foreign key to the source registry. Citation text was evidently treated as prose. Bibliography generation then had no authoritative record from which to render the reference.

Likely contributing mechanisms are context truncation, weak instructions such as “cite relevant literature,” and metadata normalization that accepts any four-digit year. A future year is not automatically invalid—online-first records can have future issue years—but it must be verified against a provider record and a configured publication-date policy. For a manuscript generated in 2026, 2028/2029 values require explicit, traceable online-publication metadata; otherwise they must be quarantined.

The frontend currently detects APA/Harvard-shaped text with a general four-digit-year regex and can resolve it against fetched literature, but an unresolved result remains displayable. The UI also consumes backend citation flags and exposes dismissal. These are useful review affordances, not enforcement. Approval and export must be blocked server-side because clients are bypassable.

### 2.2 Cross-domain misattribution

All five mismatches share a lexical-similarity pattern: broad methodological or biomedical phrases can embed near unrelated papers. Dense retrieval is behaving as a recall stage, but its output appears to have been trusted as evidence. The primary architecture fault is therefore a missing precision gate between retrieval and generation.

The gate must evaluate at least: target domain, required entities, claim type, source type, title/abstract lexical overlap, and claim–abstract entailment. A cross-encoder score alone is insufficient if it is trained for topical relevance rather than evidential support. The Rashid case is especially diagnostic: a regulatory-precedent claim should require regulatory guidance, precedent, review, or consensus material, not merely any “feasibility” paper.

### 2.3 Unresolved placeholders

`[CITATION NEEDED]` is a workflow state, not manuscript content. Its survival proves that the pipeline allowed a soft retrieval failure to cross a hard publication boundary. Zero-hit and low-confidence results should create structured unresolved-claim records, trigger bounded fallback retrieval, and block finalization if still unresolved. The generator should never be asked to hide the gap by inventing a citation.

### 2.4 Structural/sectional citation imbalance

Repeated use is not necessarily invalid, but the combination of sparse sources and methodologically diverse claims suggests candidate starvation. Sections 4–6 need claim-decomposed queries: study design, population PK, model validation, Bayesian hierarchy, regulatory feasibility, and each relevant domain entity. Corpus-level diversity should be measured across topics, source types, venues, years, and author groups; section-level checks should measure whether every externally verifiable claim is supported, not merely whether a target citation count was reached.

## 3. Log and intermediate-state verification protocol

Use one immutable `run_id`, `section_id`, `claim_id`, `query_id`, and `source_id` through every stage. Store exact payloads or content-addressed snapshots; never rely only on prose logs.

### 3.1 Search-query trace

Inspect Sections 3.3, 4, and 5, plus the affected Section 1 and 5.1 claims. Required record:

```json
{
  "event": "query_transformed",
  "run_id": "run_...",
  "section_id": "4",
  "claim_id": "claim_...",
  "query_id": "q_...",
  "original_claim": "Population PK in paediatric/ICU populations",
  "raw_query": "hierarchical population model",
  "expanded_query": "population pharmacokinetics pediatric paediatric ICU critical care nonlinear mixed effects",
  "required_entities": ["population pharmacokinetics", "paediatric|pediatric", "ICU|critical care"],
  "domain": ["pharmacometrics", "critical care"],
  "claim_type": "methodological",
  "attempt": 1,
  "created_at": "..."
}
```

Flag queries that omit the subject domain, intervention/outcome, population, or methodological task. Preserve all fallback attempts and their stop reasons.

### 3.2 Retrieval-pool dump

Capture the raw Top-N before deduplication/filtering and the normalized pool afterward:

```json
{
  "event": "retrieval_pool",
  "query_id": "q_...",
  "rank": 3,
  "source_id": "doi:10....",
  "provider": "openalex",
  "raw_metadata_hash": "sha256:...",
  "title": "...",
  "abstract": "...",
  "authors": [{"family": "Wang", "orcid": null}],
  "published_online": "2026-02-01",
  "publication_year": 2026,
  "bm25_score": 7.1,
  "dense_score": 0.82,
  "found_by": ["q_..."],
  "normalization_warnings": []
}
```

Search these dumps for Zhang, Santos, Li, Wang, Rashid, Shao, and the exact DOI/title where known. Presence proves upstream availability; it does not prove that the item reached the model.

### 3.3 Reranker scoring matrix and filter audit

Persist component scores rather than one opaque relevance number:

```json
{
  "event": "candidate_decision",
  "claim_id": "claim_...",
  "source_id": "doi:10....",
  "cross_encoder_relevance": 0.71,
  "claim_abstract_entailment": 0.08,
  "domain_match": 0.10,
  "required_entity_recall": 0.00,
  "source_type_match": 1.00,
  "metadata_valid": true,
  "decision": "reject",
  "reason_codes": ["LOW_ENTAILMENT", "DOMAIN_MISMATCH", "MISSING_REQUIRED_ENTITY"],
  "threshold_version": "citation-gate-v2"
}
```

For the five bad sources, reconstruct the full candidate matrix, model/version, calibration set, score threshold, and whether a filter was skipped. A high cross-encoder score paired with low entailment/entity scores confirms semantic collision. A rejected item later present in context confirms pass-through or context-assembly failure.

### 3.4 Prompt-context inspection and generation attribution

Record the exact ordered source registry sent to the model, token counts, truncation decisions, model parameters, and raw response:

```json
{
  "event": "generation_context",
  "run_id": "run_...",
  "section_id": "4",
  "prompt_version": "writer-v12",
  "model": "...",
  "sources": [{"source_id": "S17", "canonical_id": "doi:10....", "year": 2026}],
  "included_source_ids": ["S17"],
  "dropped_source_ids": ["S04"],
  "drop_reasons": {"S04": "token_budget"},
  "prompt_hash": "sha256:...",
  "response_hash": "sha256:..."
}
```

If Shao/Li do not exist in `included_source_ids`, classify the event as C. If they exist with corrupt dates, classify it as D+B. If mismatched papers were rejected but appear here, classify it as B. Also compare streaming partial output with persisted output to detect post-processing or regex substitution errors.

### 3.5 Placeholder and coverage trace

For every unsupported claim, log retrieval attempts, thresholds, broadened queries, external-provider results, retry budget, and terminal disposition. Separately emit per-section metrics:

```json
{
  "section_id": "5",
  "verifiable_claims": 18,
  "supported_claims": 13,
  "unique_sources": 5,
  "max_source_reuse": 7,
  "domain_specific_sources": 2,
  "method_specific_sources": 1,
  "unresolved_claim_ids": ["claim_51", "claim_59"]
}
```

## 4. Actionable code and architecture fixes

### 4.1 Make citations typed foreign-key references

Do not permit the writer to emit free-form `(Author, Year)`. Require structured output whose citations reference only IDs supplied in the prompt; render citation style afterward.

```python
from datetime import date
from pydantic import BaseModel, ConfigDict, Field, model_validator

class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str = Field(pattern=r"^S\d+$")
    canonical_id: str
    title: str = Field(min_length=3)
    authors: list[str] = Field(min_length=1)
    publication_year: int = Field(ge=1600, le=date.today().year + 1)
    abstract: str = ""
    doi: str | None = None

class Claim(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    text: str = Field(min_length=1)
    citation_ids: list[str] = Field(min_length=1)

class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claims: list[Claim]

    @model_validator(mode="after")
    def no_duplicate_claim_ids(self):
        ids = [c.claim_id for c in self.claims]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate claim_id")
        return self

def validate_draft(draft: Draft, registry: dict[str, Source]) -> None:
    unknown = {
        citation_id
        for claim in draft.claims
        for citation_id in claim.citation_ids
        if citation_id not in registry
    }
    if unknown:
        raise ValueError(f"orphan citation IDs: {sorted(unknown)}")

    raw = "\n".join(claim.text for claim in draft.claims)
    if "[CITATION NEEDED]" in raw.upper():
        raise ValueError("unresolved citation placeholder")
```

The `current year + 1` ceiling is a quarantine policy, not a statement that later issue dates are impossible. Permit exceptions only when a trusted provider supplies a verified online-publication date and retain that provenance.

Before persistence, approval, bibliography compilation, and export, enforce these invariants transactionally:

- every in-text citation ID exists in the project source registry;
- every cited source renders exactly one bibliography entry;
- every bibliography entry is cited unless explicitly allowed as “further reading”;
- author/year text is derived from registry metadata, never accepted from model prose;
- duplicate author/year pairs receive deterministic suffixes (`2026a`, `2026b`);
- zero unresolved placeholders and zero open high-severity integrity flags.

### 4.2 Add claim-to-source NLI verification

Run verification after structured generation and before prose rendering:

1. Segment the draft into atomic externally verifiable claims.
2. For every claim/source pair, score entailment using title + abstract (full-text evidence span when licensed/available).
3. Reject contradiction and low-entailment pairs; do not treat “neutral” as support.
4. Require exact entity checks for population, intervention, outcome, method, species, and document/source type.
5. Route borderline scores to manual review and record model/version/calibration.

Suggested initial policy, to be calibrated on a labelled in-domain set rather than copied blindly:

```python
def citation_gate(*, entailment: float, contradiction: float,
                  domain_match: float, entity_recall: float,
                  metadata_valid: bool) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if not metadata_valid: reasons.append("INVALID_METADATA")
    if entailment < 0.70: reasons.append("LOW_ENTAILMENT")
    if contradiction >= 0.20: reasons.append("CONTRADICTION")
    if domain_match < 0.60: reasons.append("DOMAIN_MISMATCH")
    if entity_recall < 0.80: reasons.append("MISSING_REQUIRED_ENTITY")
    return not reasons, reasons
```

Abstract-level NLI can only establish abstract-level support. If a strong claim depends on details absent from the abstract, mark it `FULL_TEXT_REQUIRED`; do not infer support.

### 4.3 Improve query transformation and hybrid retrieval

- Decompose each section into atomic claim intents before searching.
- Require domain anchors plus relevant PICO/PECO or method entities in each query.
- Generate exact-phrase/synonym/acronym variants (`population pharmacokinetics`, `popPK`, `nonlinear mixed-effects`; `paediatric` and `pediatric`).
- Use hybrid retrieval as a recall stage. Start calibration around **0.45 BM25 / 0.55 dense**, then tune on labelled in-domain claims. BM25 protects exact entities; dense retrieval supplies synonym recall.
- Apply mandatory metadata filters before reranking: publication status/date policy, document type, language where relevant, retraction status, and required domain/source type.
- Rerank claim against title + abstract + controlled metadata, not abstract alone.
- Add maximal marginal relevance or per-claim diversity only after the evidence gate; diversity must not promote irrelevant papers.
- Set a hard reject floor on entailment/entity consistency independent of the top-k rank. “Best available” is not equivalent to “good enough.”

For regulatory claims, route to a dedicated retriever over regulator/guideline corpora. For methodological claims, prefer primary methodological papers, reporting guidelines, validation studies, or domain-specific applications as appropriate.

### 4.4 Bounded fallback for unresolved claims

Use an explicit state machine:

```text
INITIAL_SEARCH -> QUERY_EXPANSION -> ALTERNATE_PROVIDER -> TARGETED_WEB_SEARCH
       -> VERIFIED_SOURCE | MANUAL_REVIEW_REQUIRED
```

Each transition must have a retry budget and reason code. External web results must pass the same metadata and NLI gates. If no source passes, preserve the unsupported claim as structured internal state, omit or weaken it in the reader-facing draft, and block final approval when the claim is essential. Never substitute an unverified citation.

### 4.5 System prompt contract

```text
You may cite only source_id values present in SOURCE_REGISTRY.
Return structured claims with citation_ids; do not write author/year citations.
Do not use prior knowledge to invent or complete bibliographic metadata.
A source is citable only when its supplied evidence entails the claim and matches
the claim's population, intervention/topic, outcome, method, and source type.
If no supplied source supports a claim, return that claim in unresolved_claims
with a search query. Never emit [CITATION NEEDED], a guessed citation, or a
replacement source. Do not strengthen a claim beyond the supplied evidence.
```

Treat this prompt as defense in depth. Schema-constrained decoding and server-side validation remain authoritative.

## 5. Repository-specific control gaps and integration points

The inspected frontend exposes literature-discovery queries, candidate screening metadata, citation flags, bibliography compilation, section approval, and export endpoints. It also distinguishes unmatched in-text citations in the editor. This supports good operator visibility, but the client types do not carry immutable citation/source IDs in generated claim text, and the UI cannot guarantee server-side enforcement.

Recommended backend integration points corresponding to the existing API flow:

- At section generation/regeneration: persist query, retrieval, reranker, context, and structured-output snapshots under the generation `run_id`.
- At citation verification: add `OrphanCitation`, `FutureDateUnverified`, `DomainMismatch`, and `PlaceholderUnresolved` as explicit mismatch types; do not require a DOI to represent an orphan flag.
- At section approval: reject open high-severity citation flags and unresolved claims unless a privileged, audited override is supplied.
- At bibliography compilation: derive entries solely from cited registry IDs and fail on any unresolved ID.
- At DOCX export: rerun the integrity invariant checks server-side to prevent bypass through stale or manually edited client state.
- In the editor: continue showing unmatched citations, but label them as blocking errors rather than merely unresolved popover content.

## 6. Verification and rollout acceptance criteria

Build a regression fixture containing all incidents in this report and require:

- 100% detection of the two orphan/future-date cases;
- rejection of all five cross-domain claim/source pairs;
- zero raw placeholders in approved or exported manuscripts;
- 100% bijective consistency between in-text source IDs and rendered references;
- no generation citation outside the supplied source registry;
- logged provenance from claim → query → candidate → score/filter → prompt source → rendered reference;
- section-level claim support coverage reported separately from citation count;
- false-positive/false-negative rates measured on a labelled in-domain evaluation set before production threshold changes.

Roll out in shadow mode first, compare old and new decisions, calibrate thresholds, then change approval/export gates to fail closed. Alert on any missing stage event for a completed run, because incomplete provenance is itself an audit failure.
