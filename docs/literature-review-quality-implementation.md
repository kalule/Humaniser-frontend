# Literature review quality implementation ? 2026-10-26

Endpoint: `POST http://127.0.0.1:8007/v1/literature-reviews/generate`.
Implementation is in this workspace's `essay-runner`, which serves this endpoint; the
separate OpenDraft benchmark evaluator is not the service implementation.

## Changes

- `literature_review/models.py`: alternate-version provenance, citation labels,
  candidate scores, independent evidence/publication classifications, supported author
  gaps, setting, competence-test classification, evidence-base and conclusion blocks.
- `literature_review/retrieval.py`: conservative version deduplication, explicit Crossref
  relationships, published-version preference, and local TF-IDF/concept ranking before
  screening. All evidence IDs are assigned after merging, so downstream passages,
  citations and audits share canonical IDs.
- `literature_review/synthesis.py` and `prompts.py`: remove abstract-omission diagnostics
  from synthesis input; require an evidence-base statement and conclusion; validate
  classification bindings; distinguish proposals, perceptions and measured outcomes;
  repair against original evidence rather than trusting suggested new facts.
- `literature_review/serialization.py`: scope, actual search failures, search counts,
  unscreened counts, evidence summaries, study table, limitations and conclusion;
  deterministic author-year suffixes; publication labels and cleaned paper links.
- New `literature_review/audit.py`: narrative-only sentence/source pairs; exact owned
  passage quotations of 1?15 words required for supported labels. Whitespace alone is
  normalized. Invalid quotations trigger a bounded retry and then an explicit
  unverifiable result, with the invalid quotation removed. Persistent schema/pair
  coverage errors fail closed. Sentence and pair denominators are separate.
- `literature_review/service.py`: one bounded repair followed by a final audit; unresolved
  audit flags, provider failures and screening-budget limits prevent a checked run
  from being labelled passed. Extracted key findings are not appended to audit input.
- Updated `literature_review/README.md`, existing synthesis fixtures in
  `test_literature_review.py`, and new `test_literature_quality.py`.

## Validation

Command: `python -B -m unittest discover -s essay-runner -p 'test_*.py' -q`.
Before: 72 tests passed. After: 95 tests passed, including 23 new synthetic regressions.
Tests cover versions/false merges, canonical IDs, ranking before the screening limit,
collision suffixes, access-diagnostic exclusion, publication/design separation, real
method disclosure, invented/cross-source/overlong quotations, pair completeness,
atomic retry handling, narrative-only auditing, and final-text re-auditing.

Synthetic before/after example: an identical-abstract preprint and journal article with
different DOIs previously survived as two records. They now produce one canonical
published paper with the preprint retained in alternate_versions. A relevant candidate
at retrieval position 31 now reaches screening before the first 30 off-topic candidates.

## Live probe

Artifacts: `essay-runner/evaluation-results/literature-quality-live.json` and
`literature-quality-live-initial.json` (initial strict-validation failure).

A bounded real request used OpenAlex and Crossref, three queries, three maximum papers,
two minimum papers, 600 target words, DOI checking and claim checking enabled.
The completed request returned HTTP 200 in 120.87 seconds, included three papers and
returned 622 narrative words. Evidence classifications were one direct empirical and
two conceptual papers. One provider query failed; 28 metadata-eligible candidates were
not screened. Both coverage limitations appear in the returned methodology text.

The final repaired narrative was audited: 31 unique sentences, 59 sentence/source pairs,
0 unsupported/misattributed pairs, 8 partial pairs and 8 unverifiable pairs. No unused or
ambiguous citations were reported. Status correctly remained `needs_review`, not passed.
The first probe exposed repeated invalid quotations causing HTTP 502; the bounded
unverifiable-result path rejects those supported judgments while allowing review repair.
Final diagnostic retry messages and dissertation-type preservation were subsequently
covered by the passing suite; they do not establish additional live quality measurements.

## Limits

This is not a measured grade improvement or a before/after study on a fixed real corpus.
Retrieval changed between live requests. Source relevance, extraction and entailment
remain model judgments. Exact quotation checks establish quotation existence, not logical
support. The search is bounded and abstract-based. Version detection is deliberately
conservative and may miss versions without author/relationship/abstract evidence.
One repair pass can leave issues unresolved; the live result still requires human review.
