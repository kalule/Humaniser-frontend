# Sequential essay API

The same Python process also exposes a dedicated literature-review API:
`POST /v1/literature-reviews/generate`. See [literature_review/README.md](literature_review/README.md)
for its request schema, response fields, pipeline, dependency injection and reference analysis.

Independent local Python service inspired by the supplied DraftService. Plans an outline
(or accepts one), drafts sections sequentially with earlier prose as context, and refines
each section. Introduction/conclusion receive smaller word budgets than body sections.
Requests are isolated; previous text is never shared between essays.

## Setup and start (PowerShell)

```powershell
cd essay-runner
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
$env:ESSAY_API_KEY = 'your-key'
$env:ESSAY_MODEL = 'your-provider-model-id'
# Optional for an OpenAI-compatible provider:
# $env:ESSAY_BASE_URL = 'https://your-provider.example/v1'
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

`OPENAI_API_KEY` is also accepted. Model must be explicitly configured and must support
Chat Completions, `max_tokens`, and JSON object response format. No keys are stored in source.
Service binds to localhost by default. This standalone API has no authentication;
use the application's authenticated backend before exposing it externally.

- `GET http://127.0.0.1:8007/health` reports process health and configuration state.
- `POST http://127.0.0.1:8007/v1/essays/generate` generates the essay.
- `http://127.0.0.1:8007/docs` provides interactive request documentation.

```powershell
$body = @{
  title = 'Should universities offer flexible deadlines?'
  word_count = 1200
  essay_type = 'argumentative'
  writing_analysis = 'Accessible academic language with concrete examples.'
  citation_style = 'APA'
  sources = @()
  refine = $true
} | ConvertTo-Json -Depth 10
Invoke-RestMethod http://127.0.0.1:8007/v1/essays/generate -Method Post -ContentType 'application/json' -Body $body
```

Optional `outline`: 3–12 objects with `main_idea` and `subtopics` (string array).
Sources accept `title`, `authors` (string array in publication order), `year` (string),
`details` (actual evidence/excerpts), and `page`. A title alone is insufficient evidence.
Response includes `essay`, actual and target word counts, outline, model and warnings.
Word count is approximate and excludes references. Evidence verification is not implemented.
Citation checks catch parenthetical author-date changes during refinement, not every citation
format or unsupported claim. Human evidence review remains necessary.

Each request makes one planning call if no outline is provided, plus one drafting call and
optionally one refinement call per section. Configure client/proxy timeouts for long requests.
Only two requests run concurrently; additional requests return 429. Provider failures return
502/504, configuration errors 503, and invalid requests 422. Partial essays are not returned.
This service is separate from existing essay routes and is not yet wired into the frontend.

## References

As in the supplied DocumentService, a source can include `apa_citation` containing an
already formatted APA reference. `formatted_citation` accepts a reference formatted in
the requested style. Optional `doi`, `url`, and `publisher` fields are also supported.
The response adds `references` (deduplicated reference strings), `sources` (metadata used
for drafting), and `full_text` (essay plus a References section). `essay` remains body only.
Only sources matched to body citations are included in the author-date bibliography.
Unused accepted sources remain visible in `sources` and `citation_audit.excluded_uncited_sources`,
but have no reference entry. Numbered-style bibliography pruning is not implemented.

With `resolve_references: true` (default), DOI sources are resolved through the existing
citation runner before drafting. The runner returns formatted references for APA, Harvard,
MLA, Chicago, IEEE and Vancouver. Without a formatted reference or successful resolution,
the API returns a basic metadata entry with a formatting warning. It does not invent
missing publication details. Numbered-style citation order is not automatically verified.

Citation connection settings come from `CitationRunner.BaseUrl` and `CitationRunner.Secret`
in the sibling backend's `HumaniseAI.API/appsettings.json`, overlaid with
`appsettings.Development.json`. Override the selected overlay path
with `ESSAY_APP_CONFIG`, or connection values with `CITATION_RUNNER_URL` and
`CITATION_RUNNER_SECRET`. Restart after configuration changes. Secrets are never returned.
DOI lookup retrieves metadata, not article evidence; supply `details` with actual excerpts.
Failed DOI lookup retains supplied metadata and adds a warning. Word document export is
not included in this endpoint.

When `sources` is empty, `auto_sources: true` (default) searches OpenAlex before drafting,
retrieving up to `source_count: 5` papers with indexed abstracts (allowed range 1–10).
It uses `Literature.OpenAlexApiKey`, `Literature.OpenAlexEnabled`, and `Literature.PoliteEmail`
from the merged appsettings files. Environment overrides: `OPENALEX_API_KEY`,
`OPENALEX_ENABLED`, `OPENALEX_POLITE_EMAIL` (or their `Literature__...` equivalents).
Credentials are sent to OpenAlex in an Authorization header, never in returned metadata.
Known retracted works and records without usable abstracts are excluded. Abstracts are
reconstructed in indexed word order; malformed position maps are rejected. Search results
also receive a conservative title overlap screen; this does not guarantee relevance.
Crossref fills shortages or serves as fallback, with DOI deduplication and visible warnings.
Returned sources include `discovery_provider` and, for OpenAlex hits, `openalex_id`.
Before drafting, abstracts are scored against the exact question with `filter_sources: true`
(default). Scores range from 0 (irrelevant) to 4 (directly studies the question); only
`scope: direct` and score >=3 pass. Screening checks actor, task, setting and outcome,
not just keywords. Administrative retrieval and instructor-side feedback are not direct
evidence for student AI use in assessed work. PREreview/peer-review comments, datasets,
retraction/erratum records and sources without evidence excerpts are excluded.

Automatic search requires at least three directly relevant sources (or `source_count`
if lower). If it falls short, the service generates two focused queries and screens
the deduplicated candidate pool against the original question again. After at most three
queries it returns 424 with the retrieval report if the minimum still is not met; it
does not fill the essay with irrelevant papers. Supplied sources are also screened,
but a user-supplied collection has no three-source minimum. `filter_sources: false`
explicitly bypasses relevance screening for controlled cases.

The response's `retrieval` object logs query history, per-round candidate scores, acceptance
decisions, evidence type and rejection reasons. Accepted sources carry `relevance_score`,
`relevance_reason`, and `evidence_kind`. Zenodo guides/reports are explicitly labelled
grey literature; a relevant framework is not treated as empirical proof. Relevance scores
are model assessments, not independent truth labels. The evaluator retains these scores
with each run so they can be compared with independently supplied marks.

Only accepted abstracts and metadata become drafting evidence. Search
ranking does not guarantee relevance; review returned sources. Full articles are not fetched.
A failed search returns 502; no usable results returns 424 instead of a silently unsourced
essay. Set `auto_sources: false` explicitly to generate a draft without supplied sources.

Tests: `python -B -m unittest -v test_main.py` (mock provider, no billed API calls).

## Citation guard and evidence audit

`verify_citations` defaults to `true`. Sources receive stable `source_id` values (`S1`,
`S2`, ...); you can also supply unique IDs. Outline sections accept `source_ids` so the
planner explicitly assigns evidence to arguments, objections and limitations. Author-date
matching supports narrative and parenthetical citations, coauthors and `et al.`. Ambiguous
first-author/year collisions are flagged rather than counted as two cited sources; supply
distinct year suffixes when appropriate. Numbered citation styles require manual coverage
review because the deterministic guard currently matches author-date citations only.

Refinement is rejected if it drops drafted/assigned sources, adds an unassigned source,
adds/removes four-digit year values, or removes over 30% of section words. Percentage
figures such as 50% are not matched by the year guard, and repeated occurrences of the
same year may be reduced without triggering it. Author cleanup splits semicolon-separated
names and removes duplicate authors before surname matching and APA initials formatting.
Keeping a draft does not certify it:
missing source assignments and uncited bibliography entries are checked again at the end.

The auditor reviews every sentence against the supplied evidence, including uncited
empirical claims. Results distinguish supported, partial, unsupported, misattributed,
unverified, inference and recommendation. Flagged issues include overstatement, invented
detail, perception presented as outcome, wrong source, scope mismatch and missing citations.
Long essays are audited in batches; incomplete/invalid model output fails with 502 instead
of being treated as a clean audit. Audit calls use a separate auditor system instruction
and temperature 0, with the same configured model/provider.

The server performs at most one repair pass by sentence offsets and re-audits any changes.
It does not loop until the model approves. The response includes `citation_audit` with
`summary`, `results`, Markdown `table`, `initial_summary`, `initial_results`, `initial_table`
and `repair_count`. Remaining issues return `status: "needs_review"` and warnings; a
successful audit returns `"passed"`. Passing requires no unsupported/misattributed or
unverified claims, at most 20% partial sentences, and complete, unambiguous source and
section-assignment coverage. Unused accepted sources are reported separately from the final
bibliography; missing assigned citations still block approval. This is model-based screening of excerpts, not independent
fact checking or a grade. Repairs can reduce length; returned word counts use the final text.

To audit an existing essay without regenerating it, POST `/v1/essays/audit`:

```json
{
  "essay": "Your existing essay with its in-text citations.",
  "sources": [{
    "source_id": "S1", "title": "Actual paper title", "authors": ["Smith, A."],
    "year": "2024", "details": "The actual abstract or evidence excerpt."
  }],
  "repair": false
}
```

For a repeatability comparison, `python -B evaluate.py --runs 5` runs five real, billable
generations of the flexible-deadlines prompt at 1200 words, freezing retrieved source
inputs before all runs. Use `--request request.json` for exact prior generation inputs.
All essays and initial/final audits are retained under ignored `evaluation-results/`,
with a summary and input hash. Expect longer generation times due to audit and repair
calls. Run all mocked tests with `python -B -m unittest discover -v`.

`probe_feedback.py --request path/to/request.json` exercises the five overclaiming examples
from the feedback against the four papers' actual supplied abstracts. It makes a real
audit call and saves `audit-regression.json` beside the request file. Do not use invented
or reconstructed abstracts for this live regression. The broad model issue `missing_evidence`
is normalized to `invented_detail` for an unsupported cited claim when the cited excerpt
is present; `reported_issue` retains the original model issue in those results.

To inspect retrieval without drafting an essay:
`python -B probe_retrieval.py --question "Should universities allow students to use generative AI in assessed work?"`.
This makes live search and model screening calls, saving full evidence and screening results
under ignored `evaluation-results/retrieval-.../retrieval.json`.
Outline planning uses its own JSON-focused system instruction and a single validation
retry before drafting. Invalid outlines still return 502 after that retry.

## Argument planning and complete-essay evaluation

`argument_planning: true` is the default. It adds a structured decision brief before
retrieval, an evidence-bounded argument plan before drafting, and a complete-essay review.
These are concise, reviewable conclusions and evidence bindings, not private reasoning traces.

The response adds:

- `argument_brief`: question interpretation, provisional position, decision principle,
  alternatives, strongest objection, evidence needs and two focused search queries.
- `argument_plan`: final qualified thesis, comparison of alternatives, permission and
  prohibition conditions where applicable, independent competence checks, and paragraph
  records containing claim, purpose, source IDs, exact supporting passages, limits,
  evidence-to-claim explanation, objection, response and connection to the thesis.
  It also includes `decision_applications`, mapping a concrete assessment context and
  assessed skill to permitted support, prohibited substitution, rationale and independent
  evidence. Assessed-AI questions require two contrasting skill-specific cases.
- `argument_review`: whole-essay issues, severity, quoted passage, suggested correction,
  initial review, guarded repair count and remaining evidence needs.

Every body section must have a paragraph record. Source IDs must exist. The server provides
an indexed evidence catalogue; the model selects passage IDs and the server inserts their
original text. Unknown IDs and source mismatches are rejected. Evidence passages must occur
in the supplied excerpts, and conclusion bindings must reuse body evidence.
Bindings preserve a conclusion claim as well as its source and passage. Plan validation
does not establish that an inference is sound; the whole-essay review evaluates that.
The writer receives the completed plan with its decision boundaries and exact source bindings.

If automatic retrieval leaves an argument evidence gap, one additional targeted search can
add up to two directly relevant sources, followed by replanning. Remaining gaps are exposed
and keep argument status at `needs_review`. Planning and review schemas have one retry;
evidence-binding validation has one retry. Invalid outputs fail with 502.

The whole-essay reviewer checks recommendations without warrants, causation from correlation,
perceptions treated as outcomes, secondary reporting attributed as primary research, abstract
silence misrepresented as study omissions, unanswered objections, vague decision boundaries,
unexamined alternatives, conclusion reattribution, repeated paragraphs and promised guarantees.
For assessed AI work, it tests whether assistance supports or substitutes for the assessed
skill, including situations requiring an independent demonstration of competence.

One argument repair pass may apply unique exact-passage replacements within outline sections.
The citation guard rejects repairs that drop assigned evidence. Citation auditing and its
bounded repair follow; the argument reviewer then rechecks the final changed essay. Cross-section,
ambiguous, or structurally unsafe edits remain flagged rather than guessed. Review findings
must quote text actually in the essay. This is a model assessment, not independent grading.

Clients should inspect BOTH `argument_review.status` and `citation_audit.status`; passing
one does not imply the other passed. Use `argument_planning: false` to disable this layer
for controlled comparisons. It adds model calls and latency. The evaluator stores both
review types with each run. No distinction or grade is guaranteed.

Literal leaked `\\n`/`\\r\\n` escapes are normalized to paragraph breaks without decoding arbitrary
Unicode escapes. Final word count is computed after repairs; differences from target above
10% produce a warning. Additional text is not inserted merely to pad the count.
