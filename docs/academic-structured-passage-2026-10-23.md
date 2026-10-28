# Structured passage repairs — 2026-10-23

The existing-corpus, targeted-retrieval and final rewrite/remove rounds in `WorkbenchService` now accept structured claims patches instead of free-form replacement prose. Invalid batches preserve the complete original draft; successful changes still go through the existing structure, claim-audit, evidence-verification and terminal CSL gates.

## Contract and permissions

```json
{
  "patches": [
    {
      "passageId": "P3",
      "claims": [
        {
          "paragraph_text": "A bounded finding.",
          "citations": [{ "source_id": "S3", "locator": null }]
        }
      ]
    }
  ]
}
```

- At most four patches; each identifies one supplied passage. Empty claims delete that passage's prose. The old `replacement` field is not accepted by production repair calls.
- Each passage may retain its known existing sources and use only the additional source IDs supplied for its claims. The existing-corpus evidence builder exposes the actual ranked candidate IDs directly, rather than inferring permissions from excerpt text. Targeted repair grants the newly supplied sources; final rewrite/remove grants no new source IDs and cannot increase citation multiplicities.
- Introduction permissions are empty. Conclusion permissions are limited to sources already cited in the original body, so a source introduced by another patch cannot appear in the conclusion in the same batch.
- Root, patch and claim shapes are validated strictly. Duplicate fields/patch IDs, unknown passages, unpermitted sources, malformed JSON, legacy envelopes and invalid claims reject the whole batch. Shared claim validation compiles source tokens deterministically; it adds no page locators.
- Section-marker blocks cannot be replaced or deleted, including headers with attached prose under LF or CRLF line endings. Replacement prose cannot introduce a marker. Non-target content and separator bytes remain exact.
- Empty/whitespace original-span anchors fall back to the actual claim text, preventing an empty string from selecting or authorizing every passage.

Infrastructure files: `Services/EssayPassageRepair.cs`, `Services/WorkbenchService.cs`, `Tests/EssayStructuredPassageTests.cs`, and `Tests/EssayRemoteWorkReasoningTests.cs`. The older `Apply` helper remains for legacy tests/comparison callers; these three production rounds call only `ApplyStructured`.

## Verification

- Infrastructure build passed: zero errors, 46 existing warnings, with `BuildProjectReferences=false` against existing dependency binaries.
- API build passed: zero warnings/errors.
- Broader essay/citation/OpenAlex regression selection: **426 passed**, including 22 new structured-passage cases. Coverage includes atomic batch rejection, scoped candidate permissions, introduction/conclusion restrictions, exact CRLF preservation, deletion, invalid envelopes, marker protection, empty anchors and fallback citation counts.
- An earlier focused repair/reasoning regression selection passed **48 tests** before the final two LF/CRLF attached-header cases were added. Those final cases are included in the 426-test run.
- Logs: Infrastructure `artifacts/structured-passage-build.log`, `artifacts/structured-passage-focused-tests.log`, `artifacts/structured-passage-regression-tests.log`, `artifacts/structured-passage-api-build.log`.

No additional model calls or provider searches were introduced. Tests use deterministic fixtures; no deployment or live critic evaluation was performed. No frontend runtime code changed; its preceding full result remains 609 passing tests.

## Remaining boundaries

The answer-quality repair in `EssayQuestionCoverage`, configured single-completion/excerpt writers and optional whole-essay revision agent still have separate prose-bearing contracts. The uncited-sentence attachment/deletion pass already returns decisions rather than generated replacement prose and was left unchanged. Claim membership validation is not proof of support; the existing post-repair evidence audit remains necessary. Persistent evidence chunks, provider-native scope adapters beyond OpenAlex, live critic evaluation and bounded parallel body drafting remain tracked in the [pipeline audit](academic-pipeline-continuation-2026-10-22.md).
