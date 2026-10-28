# Research Design bootstrap contract correction

Date: 2026-10-07.

The latest inspected failed run, `6f23153b-3967-4419-83f1-7d8b89c46ccb`, used prompt v6, one physical attempt, 2,143 input tokens and 1,415 output tokens. It failed with `InvalidModelOutput`; truncation was no longer the cause. Its raw response was discarded, so its exact offending field cannot be recovered from the retained attempt.

## Corrected mismatch

The v6 advertised output contract put enum-choice arrays in fields whose DTOs require single named strings, and a family-to-design object in `design`, which requires a string. This was a concrete prompt/parser mismatch, although the discarded historical response prevents proving which field that particular completion emitted incorrectly.

Prompt v7 now has a production-parser-valid `OutputExample` and separate `AllowedValues` vocabulary. Instructions explicitly require scalar strings, forbid vocabulary arrays/keys in output, describe nullable non-variable role/scale values and give the exact clarification item shape. A regression test passes the advertised example through decoding, deterministic materialization and the normal candidate boundary, while proving it cannot bypass readiness checks.

No output allowance, model route, retry count, acceptance rule or canonical authority was relaxed.

## Failure diagnostics

Bootstrap failures carry an application-owned stage: decode, version binding, shape, keys, taxonomy, graph or canonical boundary. Candidate decode/validation failures use their own stages. A schema-property path is retained only if it contains known contract field names and bounded numeric indices.

`ResearchDesignOutputRejected` logs project/run correlation plus that safe diagnostic. The same diagnostic is persisted in `DesignReasoningUsage.OutputDiagnostic`, so it survives completion and can be inspected without another paid attempt. The generic final parse failure on the sanitized empty response does not overwrite the earlier bootstrap diagnostic.

Exception messages, raw responses, research text and unknown property names are excluded. Unusable provider output remains discarded; existing credit settlement and durable failure behavior remain. Historical runs are not rewritten and their missing diagnostics are not fabricated.

## Verification

The initial 88 bootstrap/reasoning regressions passed after the correction. The final selection passed **225 tests, zero failures or skips**, including disposable-Postgres lifecycle, restart/replay, cancellation and acceptance coverage. Added tests cover advertised-example round-trip, separate vocabulary, each rejection stage, unsafe-path scrubbing and diagnostics retained in a failed reasoning result. The runs overlap; their counts are not additive. Backend compilation succeeded with existing unrelated warnings.

Backend changes are limited to the existing bootstrap materializer, reasoning service/prompt/contracts, a new `DesignOutputDiagnostics` helper and focused integration tests. No migrations, development database writes, new agents or live AI/literature calls were made. CodeGraph was attempted first but its backend database could not be opened; live source reads supplemented it.

Restart the API to load prompt v7, refresh Proposal Studio and use **Try again** for a new run. Old failed runs remain failed. The correction is verified against deterministic/mocked-provider tests; a live Claude outcome is not claimed.
