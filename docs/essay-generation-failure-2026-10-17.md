# Essay generation failure — 17 October 2026

The complete server log identifies the final failure at **20:58:30.945**: grouped tokens such as `[S6, S25]` and `[S17, S22]` survived to final delivery. The failed request took about **172 seconds**. The pasted excerpt ended before this final exception; the remaining lines were recovered from `HumaniseAI.API/logs/humanise-20261017.log`.

## Causes and changes

1. **Grouped citations created a repair dead end.** Drafting emitted groups that canonical-ID extraction could not see. Repair validation rejected the groups but retained the same draft; the final gate rejected it again. `SourceTokenGate.NormalizeGroupedTokens` now expands only unambiguous parenthetical source lists, e.g. `[S6, S25]` → `[S6][S25]`. `WorkbenchService` applies it at completion boundaries, before citation counting, atomic audit and final validation. Every identifier is preserved, including unknown IDs, so the unknown-source gate still rejects them. Ranges, narrative groups and mixed prose remain invalid; no source identity or citation meaning is guessed.

2. **Pre-draft evidence planning was truncated.** The actual planning call at 20:56:46 ended at 20:57:14 with `stop_reason=max_tokens`, 6,000 output tokens, and `available=false`. The old outline therefore remained unassessed. `EssayEvidencePlanning` now requests compact, minified output with at most eight selected evidence records and eight claims, brief fields and short quotes, within the same single-call, 6,000-token ceiling. Input remains bounded to twenty source texts; the output count is a context limit, not an evidence-adequacy quota. Contract checks enforce the record/claim count limits. The extraction/cache version is now `evidence-scope-v2-compact`; failure reasons are returned/logged. If planning is unavailable, the fallback explicitly treats the proposed thesis as unverified.

3. **Whole-essay instructions polluted per-claim verification.** The log rejected individually supported observations for absent mechanisms or discussion of conflicting studies. `EssayCitationVerifier.AtomicFidelityInstructions` now evaluates the atomic proposition alone and explicitly distinguishes applicability from lack of support. Mechanism and conflict applicability are represented separately; an individual observation need not assert a mechanism or summarize all studies. Actual component attribution, proxy outcomes, exposure conflation and false consensus remain subject to rejection. The previous whole-essay drafting rules are no longer appended to the isolated verifier prompt.

4. **The preliminary outline still sounded evidence-validated.** `PlanEssayAsync` now explicitly asks for investigatory/conditional claims before sources are assessed, and forbids assuming significance, component effects, downstream effects or a predetermined rebuttal of counterevidence. The UI labels the thesis as proposed and explains that source checks occur during generation. The post-retrieval evidence plan remains authoritative over the provisional thesis.

Backend files are in `../Humaniser/HumaniseAI.Infrastructure/Services/`, with the additive failure diagnostic in `HumaniseAI.Application/DTOs/Workbench/EssayEvidencePlan.cs`. UI changes are in `src/components/app/WriteWithAiModal.tsx` and `src/types/workbench.ts`. Existing user edits and enforcement settings were preserved.

## Verification actually performed

- **335 backend tests passed**, zero failed: `dotnet test ../Humaniser/HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter "FullyQualifiedName~Essay|FullyQualifiedName~SourceTokenGateTests|FullyQualifiedName~DynamicEvidenceCorpusTests|FullyQualifiedName~ResearchPaperClaimSupportEnforcementTests" --logger "console;verbosity=minimal"`.
- **35 targeted frontend tests passed**: `npm.cmd test -- src/lib/essayAuthorMetadata.test.ts src/lib/citationFormat.test.ts src/hooks/useWriteWithAiStream.test.ts`.
- `npx.cmd tsc -b` and touched-file `git diff --check` passed.
- Added regressions cover the exact leaked group shapes, preserved unknown identifiers, ambiguous forms left untouched, successful delivery with both grouped references retained, inapplicable verifier dimensions and compact-plan output limits.

After explicit user approval, **two live calls** used OpenRouter's Messages endpoint with `google/gemini-2.5-flash`, temperature zero and the revised production prompt text. These were labelled synthetic evaluation fixtures, not verified paper findings. No full article generation was performed.

| Live probe | Observed result |
|---|---|
| Planning with twenty candidate records containing five distinct synthetic extracts | Complete JSON, `end_turn`, five selected records, seven claims, all reported supporting quotes found verbatim in the inputs. The plan retained the null finding, qualified transfers, and omitted the unsupported grades claim. |
| Seven isolated semantic cases | All seven expected acceptance/rejection outcomes matched: three direct observations accepted; component overreach, false consensus, exposure mismatch and grades overreach rejected. |
| Planning latency / usage | 9,514 ms; 3,019 input tokens, 1,773 output tokens. |
| Verification latency / usage | 7,470 ms; 2,887 input tokens, 1,702 output tokens. |
| Combined provider-reported cost | **USD 0.0104593**. This is the cost field returned by OpenRouter, not an independent billing reconciliation. |

Full parsed outputs, the synthetic cases, measured timings and returned usage are in `docs/essay-evidence-live-probes.json`. `scripts/probe-gemini-essay-evidence.py` preserves the exact two-call probe for reproducibility; run it from this repository root only when live calls are intended. Credentials are read in memory and are not stored in the artifact.

The probes assess model behavior and output contracts separately from the local application regression tests. They do not prove end-to-end article quality or factual accuracy. The compact prompt was exercised on synthetic evidence, not the original sixty-source corpus. One successful probe does not establish reliability across every model run.

## Next action

Restart/reload the backend so it uses the rebuilt assemblies, open a fresh outline, and generate the essay again. The prior failed draft is not presented as regenerated or scored. If the next attempt still fails, use the final stream error plus `EssayEvidencePlanning`'s new failure reason; the former citation-group failure now has a tested deterministic repair path.
