# Follow-Up: Item 2 Row-Count Discrepancy + Item 3's Collision Fix

## Part 1 — Row-count discrepancy: reconciled, but not via dedup

**PR-27's dedup logic cannot explain the gap — checked the code directly, not assumed.**
`DedupAndMergeAgainstPersistedAsync` has no delete path at all: on a match it calls
`MergeIntoExistingLiterature`, which only sets properties on the already-tracked existing row; the
duplicate candidate is simply never added to the insert list. There is no code path anywhere in it that
removes an already-persisted row. Chronologically it also couldn't apply retroactively — it didn't exist
until after PR-25's fetch ran. This hypothesis is ruled out, not just unconfirmed.

**Checked for anything else that could explain a reduction, found nothing:**
- No general unique constraint on `project_literature` (only a narrow filtered index scoped to
  `IsMethodologyAnchor = TRUE` rows, which doesn't apply to PR-25's regular fetch rows) — so no
  DB-level constraint could have silently rejected part of a bulk insert.
- No soft-delete column on `project_literature`, no audit/history table tracking row-level deletions.
- The current 414-row batch is a single, clean, uninterrupted insert (all rows timestamped within a
  7-second window, `09:54:22`–`09:54:29`) — not the signature of a partial/retried/crashed operation.

**Most likely explanation, with the caveat that the original harness is gone and can't be re-run to
confirm with certainty**: PR-25's own reported "787 net-new (already deduplicated across queries)"
figure was an overcount by that report's own one-off harness logic, not data that existed and was later
removed. Nothing in the current database shows evidence of 787 rows ever having existed for this batch.

**Re-verified the pruning list is unchanged and safe to act on**: current pool is still 1,456 (1,042
pre-existing + 414 in the one batch), identical to Item 2's audit — nothing has changed since. The
~182-row no-signal classification from Item 2 is built against this real, stable, individually-verified
data, independent of how the historical count discrepancy resolves.

**Decision: not executed, and not planned.** Beyond the residual uncertainty in the count reconciliation,
there's a more basic reason not to run this: `SelectLiteratureForSection`'s quota+ranking design already
keeps this noise out of 5.7's actual selected output regardless of pool size — confirmed repeatedly
throughout this investigation, the section still selects its full 24/24 either way. Deleting the ~182
no-signal rows would be pool-storage cleanup, not a functional fix; it changes nothing about what the
model ever sees. Weighed against an irreversible DELETE on real accumulated data whose exact history
isn't fully provable, the risk/benefit doesn't justify running it. Held indefinitely, not just pending
review.

## Part 2 — Item 3's collision fix: no lexical fix exists, confirmed exhaustively

Re-established the exact mechanism for all three named rows via direct `ScoreClaimRelevance` calls
(not hand-tokenization, which proved error-prone in the prior pass):

| Row | Passes via | Anchor term | Title or abstract match? |
|---|---|---|---|
| Temporal muscle thickness | `measurement validity instrument reliability` (guarded) | `measurement` | Abstract only |
| Burnout Assessment Tool (BAT-23) | `variable operationalisation` (**un**guarded) AND `measurement validity instrument reliability` (guarded) | `operationalisation`/`variable` (unguarded route); `measurement` (guarded route) | Abstract-only for the unguarded route; **title-level** for the guarded route |
| Self-reported Cognitive Scales | `conceptual relationships variable construct` (guarded) | `construct` | Abstract only |

**Title-restricted anchor tested exhaustively against all 24 currently-selected rows, not just the 3
named ones** — the only way to actually know the collateral-damage rate rather than guess from a few
examples. Result: title-restriction would incorrectly exclude **at least 2 of PR-25's own confirmed
"Strict" genuine hits** —

- *"Operationalising resilience in longitudinal studies: a systematic review of methodological
  approaches"* — matches `variable operationalisation` abstract-only (no title match), same shape as
  the Burnout row it would supposedly separate from.
- *"Operationalization and measurement of compulsivity across video gaming and gambling behavioral
  domains"* — matches `construct definition` abstract-only, same shape again.

— while **not even reliably excluding actual off-topic content**: *"Modeling the effects of multiple
exposures with unknown group memberships: a Bayesian latent variable approach"* (a pure statistics
paper PR-25's own table classified off-topic) genuinely has `variable` in its title, so a title-restricted
anchor keeps it in anyway.

**And the Burnout row specifically cannot be excluded by any anchor-tightening at all**, on either
route: its title genuinely contains "measurement" ("...measurement invariance of the Burnout Assessment
Tool...") — a real, literal title match for the *already-guarded* theme's anchor, not an edge case or
a tokenization artifact. Any anchor built from these words will keep matching it, because the word really
is there, used for a genuinely different concept (psychometric measurement-invariance validation) than
what the anchor was designed to detect (construct-operationalisation methods content).

**Plain conclusion, matching PR-22's own conclusion for this exact class of problem**: distinguishing
"a paper about operationalising/measuring a construct as this paper's own contribution" from "a paper
that validates an existing clinical/psychological instrument's psychometric properties" is not a lexical
distinction — both genuinely and legitimately use "construct," "variable," "measurement," and
"operationalisation" as real, non-incidental vocabulary. No anchor design (word co-occurrence, title vs.
abstract restriction) can separate them without either keeping the collision rows in or excluding
confirmed genuine content. **Not implemented.** This is the same "semantic depth" limit PR-22 already
named for the 5.9 residual — closing it would need an LLM-based per-candidate check, not further lexical
tuning, and that's a materially different (and more expensive) mechanism than anything this
`ScoreClaimRelevance`/`ThemeAnchorTerms` design was built to do. 3 collision-suspect rows in 5.7's
24-item selected set (all disclosed, none hidden) remains a small, known, documented limitation rather
than something forced closed with a fix that doesn't hold up.

## Not committed

No code changed in this follow-up (Part 2 concluded no-fix; Part 1's pruning is pending your decision).
The verification harness (`Pr29Harness`) was deleted after use.
