# Essay-generation pipeline audit — 18 October 2026

This is a diagnosis, not an implementation. No production code, prompts, configuration or production data were modified during this audit. Earlier changes in this conversation predate this audit. Diagnostic files are confined to this directory. The supplied request ends at an unfinished “Can”; all preceding complete questions are covered here.

## Findings that explain the observed output

1. **The active writer discards much of the essay-type-aware plan.** The approved plan has assignment interpretation, essay subtype, counterargument strategy, level, body points and word allocations. The outline writer receives topic, thesis and source records, then replaces the original system/user prompts with a fixed empirical-review contract. That contract mandates framework → findings paragraphs → Synthesis → Evidence quality → conclusion ending in a research gap. This is a direct implementation cause of a policy question becoming a study summary. See `WorkbenchService.cs:921–972`, `EssayOutlineDrafter.cs:27–36`, `EssayOutlineBuilder.cs:88–147`, `EssayDraftContract.cs:42–139`, `EssaySectionDrafter.cs:35–65`.

2. **Source relevance is permissive, and different stages disagree about it.** For General discipline, an empirical claim can pass the alignment filter with one shared token. If a query produces no eligible results, the filter returns its entire ranked, ineligible pool. The pre-draft gate rejects only a corpus with zero topic-anchored sources; it does not require each admitted source to be anchored. One relevant source can therefore permit unrelated neighbours into later selection. See `EssayEvidenceAlignment.cs:41–120`, `WorkbenchService.cs:763–783,3155–3164`, `EssayTopicAnchoring.cs:46–89`.

3. **The verifier detects misattribution, but delivery does not require removing it.** Atomic verification is semantic claim entailment against independently resolved abstracts or trusted supplied passages. It is more than keyword matching. However, the shipping gate counts failed *claims*, permits failures below a default 0.34 ratio, excludes uncited/unverifiable claims from blocking, and can flag rather than block even above that threshold. `appsettings.Development.json:95–99` selects `flag`. Outline drafts also default to report-only legacy claim repair. See `WorkbenchService.cs:1360–1380,1431–1437,1644–1717`.

4. **One supported citation can conceal another unsupported citation on the same claim.** `VerifyClaimsAsync` records per-source failures, but marks the whole claim supported if any source passes. It neither removes the failed source nor gives the terminal gate a failed claim for it. A synthetic probe produced `S1=SupportedTrustedEvidence`, `S2=Misaligned`, aggregate claim `SupportedTrustedEvidence`. This is a confirmed defect in aggregation, independent of the quality of the model's verdict. See `EssayCitationVerifier.cs:238–321,399–463`.

5. **Some unsupported critical reasoning is explicitly requested.** The draft contract tells the writer to say shared authorship reduces source independence, and its validator requires naming the shared author. Authorship overlap does not establish shared participants, datasets or dependent effect estimates. The pipeline computes author overlap, not evidence overlap. See `EssayOutlineBuilder.cs:267–277`, `EssayDraftContract.cs:81–84,100–107,323–325`.

6. **Structured evidence is useful but incomplete.** There are population and direction quotes and a separate evidence-plan supporting excerpt/character locator. Yet the active draft receives compressed records without their supporting quotes; the broad `KeyFinding`, design, measures and limitations fields are not individually passage-validated. There is no structured between-group contrast, component attribution, outcome-specific estimate or tested-moderator contract. A generic effect direction is later used to select roles and causal ceilings. See `SourceRecordExtractor.cs:154–205`, `SourceRecord.cs:11–50`, `EssayEvidencePlanning.cs:154–212`, `EssayOutlineBuilder.cs:80–85,317–328`.

7. **Final checks are largely advisory, and some checks precede later edits.** The record-based verifier can report High failures and still return the essay. Repairs may change prose after the atomic audit and bibliography checks; they get heuristic verification but not a new atomic entailment pass. Earlier audit summaries can therefore describe earlier wording. See `WorkbenchService.cs:1956–1970,2054–2081,2153–2241,2250–2275`.

These are failures across retrieval admission, planning handoff, drafting contracts, repair and enforcement. The evidence does not support blaming bibliography formatting alone or assuming the system has no claim-level verifier.

## Evidence and confidence

“Confirmed” below means directly established by current source, a deterministic probe or a recorded runtime event. Historical logs establish what that run did, not the exact current deployment version. The repository is dirty, and logs cover changing implementations: older runs executed whole-essay repair, while current outline defaults skip that repair. Do not treat every historical event as if it ran today's code.

The audit used the actual adjacent backend repository `Humaniser`, not an assumed frontend-only pipeline. CodeGraph was consulted first; it flagged backend service entries as stale, so current files were read directly. The supplied CodeGraph instructions and backend `CLAUDE.md` were read. No repository `AGENTS.md` was found in the backend search. Backend routing instructions state that essay work is outside the five-capability model-router seam.

### Runtime A: social media / university academic performance

`HumaniseAI.API/logs/humanise-20261018_004.log` contains the reported source mismatches:

| Log lines | Observed event |
|---|---|
| 3112–3175 | Twenty abstract-based source records; evidence plan available; outline has three body sections and nine assigned sources. |
| 3271–3340 | Initial verification is followed by uncited-sentence patch and existing-corpus repair. |
| 3690,3764 | Populism source S42 rejected for academic impact / attention-management claims. |
| 3707,4285,4611 | S46 rejected for “context of use” mediation; verifier identifies the abstract as AI in prehospital emergency care. |
| 4044,4405 | Targeted repair and rewrite/remove fallback execute. |
| 4701–4704 | Thirteen remaining integrity failures over 42 cited claims; 29 supported. Unique sources increase from 4 before repair to 39 after repair. |
| 4713 | The generation is recorded as `Succeeded`. |

This confirms detection without successful removal. The 13/42 ratio is approximately 0.310, below the current default blocking ratio. The exact historical effective configuration is not reconstructed, but the recorded success is unambiguous. The verifier's own prose is fallible: line 4611 also calls 2025 “in the future” in a 2026 log. Treat that as a model error, not evidence about the source's date.

The increase from four to 39 cited sources during repair is strong evidence that repair amplified citation breadth. The exact first attachment of every S42/S46 occurrence cannot be established without the intermediate drafts; this report does not claim a complete edit-level reconstruction.

### Runtime B: permission for generative AI in assessed coursework

`humanise-20261018_008.log:2326,2549,2560,2624,2783–2837` matches the policy question:

- 60 retrieved candidates; 20 source records, all based on abstracts.
- Evidence planning fails its JSON/contract check; outline drafting nevertheless proceeds.
- An attitudes paragraph is dropped because all its sources are `context_only`, illustrating how an effect-oriented schema excludes non-effect material.
- The outline has two body sections and three assigned sources; 17 usable records are unassigned.
- Atomic audit reports 24 evidence-requiring claims: four cited, three supported, one unsupported, 20 uncited. Recorded coverage is 12%.
- Final outline contract reports **zero violations**, yet the later verifier reports ten findings, including High claim-to-source and High uncited-claim findings.
- The generation is recorded as `Succeeded` with 20 flags.

Passing the layout contract is therefore not evidence that this policy question was adequately answered. These logs establish the route and outcomes; they do not contain enough preserved prose to independently grade every promised safeguard.

Selected log lines, with user IDs removed, are in [runtime-evidence.txt](runtime-evidence.txt).

## Active execution path and contracts

Backend paths in this section are relative to `Humaniser/`; frontend paths are relative to `Humaniser-frontend/`. Line ranges refer to files inspected in this audit. A hash/timestamp manifest is included for the core files and compiled diagnostic assembly.

| Stage | Code and line range | Input → output; active behaviour |
|---|---|---|
| UI setup / plan review | Frontend `WriteWithAiModal.tsx:94–125,204–255,539–570`; `api/workbench.ts:32–34` | Topic, subtype, level, discipline, style, target → `PlanEssayRequest`; reviewed/editable `EssayPlan` → `WriteWithAiRequest.approvedPlan`. Subtype defaults to Argumentative; selected explicitly, rather than reliably inferred from the command verb. |
| Planning endpoint | `API/Controllers/WorkbenchController.cs:363–368`, `PlanEssay`; `Infrastructure/Services/WorkbenchService.cs:244–303` | Full question → conditional provisional thesis, assignment analysis, body claims/evidence needs, counterargument strategy, voice, critical depth, allocations. JSON schema example, parse/coercion, normalization and structural validation; no source assessment yet. |
| Active generation endpoint | Frontend `hooks/useWriteWithAiStream.ts:64–137`; backend `WorkbenchController.cs:226–309` | POST `/api/v1/workbench/write-with-ai/stream` → SSE stage/result/error frames. Calls `WriteWithAiAsync`; current configured hard cap 900 seconds, clamp 120–900. HTTP 200 can carry an error frame; status 200 alone is not success. |
| Audit wrapper / dispatch | `WorkbenchService.cs:564–655` | Request → core result → generation-audit row and ID. Typed integrity exceptions record Blocked. CaseStudy and ResearchPaper dispatch separately. Other exceptions/cancellation are not all recorded by this wrapper. |
| Normalize / search | `WorkbenchService.cs:657–678,2975–3092,3128–3203` | Preserve original question; strip a category prefix; full topic plus first evidence need per body point (or claim/purpose) plus counterargument strategy → structured and flat queries → retrieved literature tuples. Bounded concurrent fan-out, round-robin merge/dedupe. |
| Provider orchestration | `LiteratureOrchestrator.cs:191–241,265–281,325–345,396–416` | Primary-provider relevance-ordered pool; enrich on shortfall; supplementary results ranked by citation velocity after basic title/year filtering and identity dedupe. Primary configurable as OpenAlex or ConsensusApi. |
| Candidate admission | `WorkbenchService.cs:3050–3092,3155–3164,763–783`; `EssayEvidenceAlignment.cs:41–120` | Heuristic relevance score/eligibility → bounded task corpus. Empty eligible set falls back to ranked original results. Corpus admission requires at least one anchored source, not every source. |
| Uploaded evidence | `WorkbenchService.cs:680–701,3390–3409` | Selected library contents ranked by word overlap → first 4,000 characters, source ID/provider metadata and passage start/end. It does not fetch entire uploaded papers or independently verify the user-supplied text. |
| Source records | `WorkbenchService.cs:144–164,797–800`; `SourceRecordExtractor.cs:30–145,154–205` | Top relevance-ranked 20 candidates by checked-in config → independent per-paper structured records. **Actual essay call passes FullText=null.** Concurrency, 45-second extraction budget, one stronger-model quote retry. Failures preserve unknowns. |
| Evidence planning | `EssayEvidencePlanning.cs:44–125,154–212`; `WorkbenchService.cs:792–821` | Up to 20 abstracts (first 3,200 characters) + provisional plan + compact extracted records → up to eight evidence records/eight planned claims, scope, bounded thesis, gaps. One 60-second call; malformed output returns unavailable + review flag and drafting continues. |
| Outline | `WorkbenchService.cs:927–960`; `EssayOutlineDrafter.cs:27–36`; `EssayOutlineBuilder.cs:88–244` | Topic + bounded/provisional thesis + records → new outline with effect roles, per-section source IDs, limitations, disagreements, research gap and ceilings. Enabled in config; minimum 800 target words, two usable source records and two surviving body sections. Otherwise legacy drafting. |
| Active section drafting | `EssayDraftContract.cs:42–139`; `EssaySectionDrafter.cs:19–65`; `WorkbenchService.cs:963–972` | Assigned records + fixed outline → framework/body calls (concurrency three), then synthesis/quality, then conclusion. Per-call 900 tokens. Layout assembled in code. Does not receive original approved body plan, counterargument strategy, subtype or level. |
| Conformance / style | `EssayOutlineDrafter.cs:39–87,92–162,167–258`; `WorkbenchService.cs:1054–1089` | Contract violations → one layout retry, bounded paragraph repairs/style pass. Guards check citations, length, introduced numbers and layout—not semantic equivalence of every rewritten claim. Broken layout falls back to excerpt drafting; other surviving violations can be flags. |
| Atomic audit | `EssayClaimAuditService.cs:97–141,145–195,223–266`; `WorkbenchService.cs:1327–1348` | Essay prose → atomic propositions, positions, evidence-required flag, intended source IDs. Model-based extraction, 45 seconds/6,000 tokens. Can salvage malformed items up to a 25% dropped-item threshold; failed audit is unavailable, not a hard refusal. |
| Atomic source support | `EssayCitationVerifier.cs:144–195,200–477` | Evidence-requiring cited claims × attached source IDs → per-pair status plus aggregate claim status. Canonical DOI/OpenAlex-ID resolution, else trusted provider/passage; deterministic alignment/date checks followed by semantic model entailment. Chunked parallel calls. Any passing pair makes the claim supported. |
| Claim repair | `WorkbenchService.cs:1434–1624` | Optional attach/delete patch, existing-corpus patches, claim-specific retrieval, targeted rewrite, removal fallback; accepted edits re-audited. **Current outline default `ReportOnlyClaimAudit=true` skips these legacy rounds.** Earlier observed social-media run executed them. |
| Shipping / citation cleanup | `WorkbenchService.cs:1644–1747,2054–2081`; `EssayCitationDiscipline.cs:28–88` | Ratio-based integrity policy and optional flags; placement normalization; remove low-overlap repair-added parentheticals, cap contiguous groups at two; token validity and bibliography orphan checks. These are not a zero-error per-source entailment guarantee. |
| Later verification / repair | `WorkbenchService.cs:2096–2241`; `EssayVerifier.cs:28–59`; `EssayVerificationRepair` | Final outline drift reported; optional revision loop; record-based heuristic verification and targeted paragraph repair. Verification/repair enabled in base config; revision loop disabled. Remaining High/Medium findings are flags. |
| Argument quality | `WorkbenchService.cs:2293–2319`; `ArgumentativeQualityService.cs:34–87`; `CounterEvidenceRebuttalChecker.cs:25–67` | Title/introduction/body/conclusion → lexical thesis/redundancy/counterargument/method-evaluation findings. Original question and approved plan are absent from `ArgumentativeDocument`. Only blocking thesis-pattern findings can refuse a draft; objection/safeguard adequacy is not semantically established. |
| References / response | `WorkbenchService.cs:1733–1736,2054–2081,2250–2275,3412–3441` | Normalize duplicate work aliases, reject unknown IDs/orphans, retain only cited canonical references → body/sections/references + audits/flags/evidence issues. A token mention is enough to count a reference as used; meaningful discussion is not required. |
| Render / save / export | Frontend `DocumentEditorPage.tsx:771–856,920–927`; `essayCitationTokens.ts:25–63`; `essayReferenceOrder.ts:25–68`; `wordExport.ts:8–34` | IDs resolved by sourceId, then author/year display or first-use numbers using the same ordered reference array. Current full generation replaces content. Saved editor JSON/HTML exported as Word-compatible HTML `.doc`; no fresh evidence verification during export. |

### Prompt precedence: assembled, not merely declared

The legacy system prompt composes structure rules, `WritingQualityRules.EssayReasoningDoctrine`, `EssayEvidencePlanning.Rules`, general style/no-invention rules and citation guidance. Its user prompt includes the approved plan and evidence map/plan (`WorkbenchService.cs:856–924`). It explicitly says the evidence-bounded plan overrides provisional framing but not the question.

The active outline branch **replaces**, rather than augments, those system/user prompts at `WorkbenchService.cs:954–957`. Its replacement is `EssayDraftContract.SystemPrompt(outline)` and `UserPrompt(topic,outline,records)`. The latter serializes only outline thesis/framework/body/disagreements/quality/conclusion and assigned record fields. It carries neither the full evidence plan's scope/claim actions nor the original provisional plan. Thus inspecting the legacy “Use the approved … plan” instruction alone gives the wrong account of the active writer.

Each section call appends the one-paragraph instruction and its length limit. Each still carries **all assigned records**, with section ownership enforced through prompt and contract. Cross-cutting sections receive the already written body. The conclusion sees body and synthesis, but the framework/introduction is drafted alongside the body before either is available. There is no final promise-to-body coverage check.

Generated synthetic assembled system/user messages are preserved in [assembled-system.txt](assembled-system.txt) and [assembled-user.txt](assembled-user.txt). They are actual outputs of the compiled prompt builders with diagnostic records, **not a claim to have captured the exact historical model request**.

### Models, provider transport and retries

`PipelineModelConfig.cs:48–69` resolves per-stage overrides; planning/evidence planning default to `Claude:Model`; extraction/style default to `Claude:FreeModel`; extraction retry/outline/drafting/repair have distinct fallbacks; ClaimAudit may pass no explicit override. `EssayCitationVerifier` calls `CompleteAsync` without a model override for atomic verification, so that stage uses the main model. There is no separately configured semantic verifier stage in this path.

Checked-in development config selects `Llm:Provider=OpenRouter`, `Claude:Model=google/gemini-2.5-flash`, free model `claude-haiku-4-5-20251001`, and default 2,000 tokens. Base config selects Sonnet and 8,192 tokens. Logs for the inspected runs confirm Gemini on draft/audit/verification and Haiku extraction. Environment/user-secret overrides were not read; effective production model choices remain unknown.

`LlmProvider.cs:33–53,89–96,122–139` selects provider URL/authentication and rewrites model IDs at transport. Logs show `openrouter.ai/api/v1/messages`; an `AiCallLog` “Provider=Anthropic” label is therefore not proof of an Anthropic-hosted model.

`ClaudeService.cs:523–541` sends system plus one user message, with temperature 1.0 unless the stage explicitly supplies zero. Planning and ordinary drafting therefore differ from deterministic extraction/evidence-planning/verdict calls. `CompleteAsync` uses `rejectTruncation=false` by default; malformed/truncated structured outputs must be caught by downstream parsers. This is consistent with the unavailable evidence plans in the logs, but does not prove truncation was the particular parser failure.

The shared HTTP pipeline retries transient errors/429 and has timeout/circuit-breaker policies (`DependencyInjection.cs:140–163`). `CompleteAsync` does not opt into the capability-router fallback-model argument (`ClaudeService.cs:1199–1302`). Workflow retries are the specific plan/quote/layout/repair paths described above, not an automatic escalation to a better essay model.

## Claim-to-source matching answers

### Retrieval and source selection

- **Query origin:** initially full question plus approved evidence needs/counterargument strategy; later legacy gaps use individual unresolved claim text plus discipline. Only the first evidence need per point is used. Initial structured retrieval reattaches topic anchors; gap retrieval does not use that structured helper (`WorkbenchService.cs:3444–3456`).
- **Broad terms:** `QueryTermExtractor.cs:50–61,129–152` removes a generic list including “context,” chooses at most eight terms by acronym priority/length and restores input order. It does not understand PICO, policy command verbs or population/exposure/outcome roles. “performance”/“learning” can remain. Alignment uses a *different*, much smaller stop list and word overlap, so a word removed during query construction can still admit a source at alignment. Required `Should`/`permit` also appear in the policy run's query logs.
- **Provider bypass of structured query:** with Consensus as primary, OpenAlex enrichment calls ordinary `FetchAsync(searchQuery,…)`, not `FetchWithScopedQueryAsync(structuredQuery,…)` (`LiteratureOrchestrator.cs:337–341`). Consequently the carefully anchored Boolean query is not the query used on every provider route. Flat relaxation also occurs on zero structured results.
- **Population/topic/exposure/outcome assessment:** the early deterministic filter assesses broad domain, overlapping words and some named entities. It has no structured population/exposure/outcome comparison. Evidence planning and semantic verification later ask these questions, but the active outline loses most of the former's per-claim scope decisions.
- **Direct versus indirect:** evidence planning has direct/indirect/conflicting statuses. Outline population matching instead reduces any student sample to `direct` when the topic contains students/university/college. A fifth-grade student probe returns `direct`. The later verifier can warn about school/university transfer (`EssayVerifier.cs:315–336`); that does not correct the earlier classification or guarantee refusal.
- **Pool isolation:** sources are local per request; S IDs are assigned after selection and gap IDs offset existing count. No evidence was found of a global previous-essay source array being accidentally reused. Shared public-result caches can legitimately return the same work on repeated/normalized queries. Weak query/admission rules can then reuse an irrelevant work; that is not proof of cache-key collision.

### Extraction, provenance and unknowns

The actual web source basis is metadata plus abstract. The essay's `ExtractSourceRecordsAsync` always passes `FullText:null`. The extractor supports full text generally, but that capability is not wired into this essay call. My Files uses a bounded supplied passage. No new full-text retrieval occurs inside atomic verification; its input explicitly supplies an empty full-text field (`EssayCitationVerifier.cs:345–349`).

There is no source-record model call for title-only/no-text input: it returns NoText. Evidence-plan validation clears findings for metadata-only sources. Legacy excerpts still include titles when abstracts are missing, so the fallback writer can see a title; no general mechanical guarantee prevents it inferring from that title. The extractor allows verbatim title spans as population/direction quotes when some text is available, but this is not a policy to invent findings from titles.

Source records retain IDs through a caller dictionary and population/direction quotes; the separate evidence plan retains `supportingExcerpt` and a character locator. Its validator checks the span exists and findings are present, **not that every finding is entailed by that span**. The outline's drafting payload drops the quotes/locators and serializes prose findings and design fields. Its “not stated”/null handling is valuable, but there is no typed distinction between a paper author's causal interpretation and a measured result in the broad KeyFinding field.

### Drafting, insertion and repair

The active outline writer uses a subset of extracted/assigned sources, not every raw search result. Default extraction covers at most 20 candidates; each body section owns at most three sources and a source can belong to only one body section. The model's outline assignment is not deterministically re-entailed against the proposed main claim: normalization validates source existence, role/direction consistency and counts.

Initial citations are generated alongside prose as `[S#]`/`[N:S#]`. The browser only renders those tokens; it does not choose a source for a sentence. Legacy uncited-sentence patch and subsequent repair can attach citations **after drafting**, using overlap-ranked evidence windows and model decisions, followed by re-audit where accepted. This explains how sources outside the original small draft citation set can proliferate.

The real semantic matcher is `VerifyClaimsAsync`: a model sees an atomic proposition and one real abstract/passage, with outcome, construct, exposure, mechanism, causal, numerical, conflict, scope, geography and comparison fit instructions. It is not an embeddings-only matcher. Deterministic overlap is a prefilter and repair-ranking tool, not the entailment verdict. The independent verifier is nevertheless abstract-limited, can misread evidence, and sees the extracted claim without the whole essay/question context.

Legacy drafting explicitly asks for every factual sentence to be cited and computes an adaptive touch target (`WorkbenchService.cs:365–369,885–910`). A fallback compares *distinct cited sources* with a target described as “touches.” On the current successful evidence-plan/outline branch this minimum is zero (`984–986`), so the old density retry is bypassed there. The outline contract instead asks each assigned study to be reported and cited. Do not attribute all current padding to the old quota: the historical repair expansion is separately evidenced.

No active atomic matcher inserts the nearest available source as an unconditional fallback. The legacy citation-led verifier (used when no claim auditor is supplied) substitutes only a model-rated yes above its threshold, else emits a citation-needed marker. That route is a compatibility path: production DI registers the atomic auditor (`DependencyInjection.cs:463–476`). It should not be confused with the active path that detects but tolerates some failed pairs.

Citation discipline is also narrower than its name: it checks overlap for **repair-added parentheticals**, exempts original-draft IDs and narrative tokens from that removal, and caps only contiguous token clusters at two. Comma-separated clusters and semantically weak original citations are not comprehensively screened by that regex (`EssayCitationDiscipline.cs:19–63`). It can remove a citation while leaving the assertion, and the final application occurs after the earlier atomic summary was computed.

### IDs, bibliography and final assembly

Canonical-work alias consolidation, gap-ID offsets, unknown-ID checks, orphan checks, first-use numbering and author/year suffixing are real safeguards. The renderer finds by `sourceId`, then uses the resulting ordered-array index consistently for numbers and reference entries. No evidence was found that a simple S-array index shift or author/year collision caused the observed S42/S46 mistakes. Title-only canonical dedupe remains weaker than DOI identity, but an actual collision was not demonstrated.

Only cited works appear in the newly generated reference list. “Cited once” is not “meaningfully discussed,” however, and there is no final substantive-use test for each reference. Earlier full-generation append behaviour could mix multiple drafts' bibliographies; current `handleAiGenerated` replaces them. This historical editor problem is distinct from the backend's within-draft misattribution.

Two additional final-assembly inconsistencies are confirmed in source, but were not reproduced through a full live request:

- `claimSummary.AuditAvailable` is assigned at `WorkbenchService.cs:1970`. A kept verification repair later sets the local `claimVerificationCompleted=false` at `2220`, but does not update that already-built summary. The response can therefore carry an earlier available-audit summary alongside a flag saying final wording needs evidence review.
- Final citation discipline changes `content` at `2054`, then updates IDs/references, but does not immediately reparse `sections`. If it removes citations and no later accepted repair reparses sections, `Content` and `Sections` can differ. The editor renders `Sections`, while reference membership follows `Content`; missing parentheticals then disappear in the browser's tolerant resolver. Length-compression fallback also restores old sections at `1910–1912` then assigns `compressedSections` at `1927`. These conditional branches need focused response-consistency tests before claiming the final render is always the verified text.

The modal calls `onGenerated` before showing audit warnings; essay flags are temporary toasts (`WriteWithAiModal.tsx:257–282`). The editor persists prose and a generation-audit ID, not the complete per-claim evidence issue contract in this save path. Export does no grounding checks. Thus a flagged draft can look like an ordinary successful, exportable document even when the backend identified failures.

## Why critical analysis can become unsupported reasoning

| Observed reasoning failure | Established mechanism; remaining uncertainty |
|---|---|
| All groups improve → intervention benefit | SourceRecord has overall direction, not a typed between-group contrast. An experimental design yields a causal ceiling. Probe: normalization accepts “improved beyond controls” despite a record saying both groups improved. This proves the outline validator gap, not that a real extractor always makes that error. Semantic comparisonFit can catch it later, subject to aggregation/enforcement gaps. |
| Study differences → proven explanation | Outline schema names the axis `explainedBy`; `AxisDiffers` uses stem-set dissimilarity, and follow-up can pass from a timing word in either record. Those checks establish neither a tested moderator nor causation. Current prompts require “possible” explanations and conformance rejects listed unhedged explanation phrases. This is a partial safeguard; style rewriting explicitly demands because/so/since reasoning without seeing the original source passages. |
| Combined intervention → one component | Manipulation is one free-text field; overall direction/design can authorize an effect role/ceiling without a structured component contrast. Atomic exposureFit, comparisonFit and mechanismFit are intended to catch this, but there is no upstream guarantee and known final-policy gaps remain. No exact historical component-attribution claim was independently reconstructed in this audit. |
| Shared author → overlapping evidence | Confirmed prompt/validation error: same-author keys are used to mandate a reduced-independence statement. Even confirmed name identity does not demonstrate overlapping data. No dataset/cohort overlap extraction feeds this rule. |
| Neural activation → capacity/efficiency | Extraction instructions explicitly require neural and behavioural outcomes separately; this is a real safeguard. Yet broad direction/KeyFinding fields and an experimental→causal ceiling do not preserve a typed outcome/estimand mapping. The deterministic draft outcome check only covers selected outcome families and even skips a family when it occurs in the topic (`EssayDraftContract.cs:333–343`). Current atomic outcomeFit should help; acceptance still depends on model accuracy and delivery policy. |
| Small pool → “no study exists” | Outline builder asks for one research gap; conclusion must end with it. A universal-absence researchGap survives normalization in the probe. Prompt language “No reviewed study…” is narrower than universal absence, but neither search coverage nor gap validity is mechanically established. Scope/uncited warnings are not equivalent to validating a literature-absence claim. |
| Introduction promises undeveloped safeguards | Intro and body are drafted independently. The active contract is missing the approved counterargument/policy-condition structure; the final argumentative checker receives no original question or plan. It checks lexical moves, not coverage of policy criteria or introduction promises. This is a confirmed design gap; the exact historical intro/body mismatch still needs preserved prose to grade. |

The system does contain explicit no-invention rules, conditional interpretation guidance and multiple checks. The diagnosis is not “there are no rules.” A fixed mandatory synthesis/quality/gap structure sometimes asks for an inferential move the evidence cannot sustain; several local validators then verify layout or vocabulary instead of that inference, and the terminal route can ship known failures.

## Caches and invalidation

| Cache | Identity / lifetime | Audit implication |
|---|---|---|
| OpenAlex search | `openalex:search:{evidenceType}:{preparedQuery}:{limit}`; scoped-query variant; 24h (`OpenAlexProvider.cs:25–26,64–76`) | Cross-request public search reuse. Query-normalization loss can make two intents share a search. No demonstrated random cross-essay source mixing. Search policy/version is not part of these keys. |
| Canonical OpenAlex work | DOI or OpenAlex ID; 30 days, with database mirror fallback (`OpenAlexProvider.cs:81–145`) | Correct identity is stronger than topical overlap, but existence is not support. Mirror lookup shown here does not check age before deserializing. |
| SourceRecord | version v4 + normalized DOI/title hash + text basis + text hash; 30 days (`SourceRecordExtractor.cs:23–27,93–119,140–145`) | Text/version changes invalidate; model and bibliographic metadata changes are not included. Records are question-independent by design, but stale extraction/metadata can persist after model changes. No demonstrated cache collision in these incidents. |
| Compact evidence extraction | SHA256(version + canonical identity + access + text); 6h; 256 entries (`EssayEvidencePlanning.cs:13–21,41–42,103–110,139–150`) | Public only; uploaded documents excluded. Rewrites cached sourceId to current ID and clears claim-relative limitations. Model not in key. Reuses extraction, not an entire previous essay plan. |
| Consensus results | provider + normalized query + effective limit + filters; default 720min, empty 30min (`ConsensusApiProvider.cs:121–130,182–195`; `ConsensusApiClient.cs:36–39`) | Shared public results and in-flight coalescing. Projects intentionally not keys. No retrieval-policy/model version in the shown key. |
| Draft / outline / claim verdict | No cross-request essay draft/outline/verdict cache in the inspected active functions | Does not establish that unrelated platform features have no caches. This audit did not exhaustively enumerate every provider's internal cache. |

## Alternate paths and safeguard bypasses

- Non-streaming `/write-with-ai` calls the **same** service with user ID (`WorkbenchController.cs:158–167`); it does not bypass the core essay safeguards, although its request lifetime differs from the SSE action's explicit hard cap.
- Choosing document type General reaches general prose generation, bypassing essay plan requirement, atomic essay audit and essay-only integrity/argument gates. It is not a safe alternate route for an essay merely because the prompt is an essay question.
- Short essays below 800 words, disabled source records/outline configuration, unusable records or broken outline layout take legacy excerpt drafting. They retain a different prompt and retry policy. Current base config enables the outline; this is conditional, not universal.
- My Files-only can lack attributable bibliographic metadata and independently resolvable web IDs; it uses trusted supplied evidence. That is a different evidence tier, not proof of canonical source identity.
- `ContinueWritingAsync` / editor Write On uses its own topic/first-150-character search, numeric citation instruction and general-knowledge permission (`WorkbenchService.cs:2858–2915`). It does **not** run this essay planning/atomic-audit pipeline. This is a confirmed alternate path bypassing the audited essay safeguards.
- LiteratureReview has a separate durable streaming/job route; CaseStudy/ResearchPaper have separate service branches. This audit does not transfer essay guarantees to them or claim a full audit of their pipelines.
- Editor and `.doc` export accept already delivered/edited prose without rerunning the essay pipeline.

## Diagnostic results and limits

The [probe source](probes/Program.cs) calls existing compiled production classes with synthetic records and mocked providers. It performs no real searches, model requests, database reads or writes. The project uses the existing friend-assembly name solely to access internal pure functions; no production assembly or test file was changed.

[probe-results.json](probe-results.json) reproduces:

1. Fifth-grade students → `PopulationMatch=direct` for a student/university outline.
2. All candidates ineligible → filter retains one unrelated candidate.
3. Unsupported between-group main claim survives outline normalization.
4. That section receives `causal` ceiling based on experimental design.
5. Universal absence research gap survives normalization.
6. Assembled draft system mandates Synthesis and reduced independence from shared authorship.
7. Mixed valid/invalid citation pair → aggregate supported claim while the invalid pair remains Misaligned.

These are reproductions of permissive behaviour, not claims that every generated essay takes every failure path.

Existing test results:

- Backend selected essay/source-record/argument/outline tests: **383 passed, one skipped**, zero failed in the filtered run. See [essay-audit-filtered.trx](essay-audit-filtered.trx).
- First narrower run: 100 passed; one report-writing test failed only because it tried to write a baseline Markdown file beside the adjacent backend assembly, outside the writable workspace. It was excluded on rerun; there was no assertion failure. Original result retained in `essay-audit.trx`.
- Frontend citation ordering, token rendering and Word export: **18 passed**, three files.
- Tests and probes used existing backend DLLs; the backend was not rebuilt. Infrastructure DLL timestamp was 14:43 on 18 October, later than the inspected core outline/verifier source timestamps. Timestamp alone is not build provenance: exact commit/source-to-binary correspondence is not proven. [source-manifest.json](source-manifest.json) records hashes/times.
- No new live generation was run, no production essay was altered, no provider quota was consumed, and no production database was queried by the audit.

Reproduce from frontend root:

```powershell
dotnet run --project docs/essay-pipeline-audit-2026-10-18/probes/Probes.csproj
npm test -- src/lib/essayReferenceOrder.test.ts src/lib/essayCitationTokens.test.ts src/lib/wordExport.test.ts
```

The probe project targets the available .NET 10 runtime to resolve the already-built backend's v10 logging dependencies; it references the existing net8 backend/test-support DLLs. It has no production project reference and does not rebuild the backend.

## Decisions supported by this audit, before any implementation

The highest-priority implementation boundaries are now concrete: preserve question/type/objection obligations through the outline handoff; make delivery decisions at claim–source-pair level; separate population level and treatment contrast from broad effect direction; stop treating author overlap as dataset dependence; and revalidate final delivered text after the last rewrite. These are diagnoses of the traced contracts, not a proposal to add more generic prompt instructions.

Open questions requiring further evidence are the exact intermediate drafts for every cited mismatch, effective historical/production overrides, completeness of retrieved source texts, the actual raw model output that invalidated each evidence plan, and whether the specific neural/component-control errors were present in the inspected historical runs. The current code and synthetic probes establish routes by which those errors can survive; they do not establish the frequency of each error across production.

## Source entry points

- [Generation service](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser/HumaniseAI.Infrastructure/Services/WorkbenchService.cs:634>)
- [Outline construction](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser/HumaniseAI.Infrastructure/Services/EssayOutlineBuilder.cs:88>)
- [Actual outline drafting prompt](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser/HumaniseAI.Infrastructure/Services/EssayDraftContract.cs:42>)
- [Atomic semantic verifier and aggregation](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser/HumaniseAI.Infrastructure/Services/EssayCitationVerifier.cs:200>)
- [Source-record extraction](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser/HumaniseAI.Infrastructure/Services/SourceRecordExtractor.cs:30>)
- [Evidence planning and excerpt validation](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser/HumaniseAI.Infrastructure/Services/EssayEvidencePlanning.cs:44>)
- [Editor assembly](<C:/Users/42153/OneDrive/Desktop/IT Projects/Humaniser-frontend/src/pages/app/DocumentEditorPage.tsx:771>)
