# Section-Order Defect + 5.7 Citation Thinness — Investigation

Investigation only, per task scope — no code, prompt, or data was modified. Project: "Automated
Runtime Vulnerability Detection and Micro-Segmentation in Event-Driven Containerized Architectures
Using eBPF and Zero-Trust Policies" (`20f54592-95da-46da-a51a-15f68ef7736a`), `MethodologyType` =
Quantitative. Evidence: read-only queries against `humaniseaidb` (`research_projects`,
`project_sections`) via a local Python/psycopg2 session, plus read-only queries against the local Seq
instance (`localhost:5341`) for the real `GenerateSection: theme-selection` log line emitted during
this project's actual 5.7 generation run. No live provider/Claude calls were made.

## Issue 1 — Section-order defect

**Root cause found: `HumaniseAI.Infrastructure/Services/ResearchService.cs:447-483`.** Two static
arrays define every section's `Order` integer, assigned once at row-creation time and re-derived
identically at export time — not a per-project data issue, not a string-sort artifact.

```csharp
private static readonly (string Code, string Title, int Order)[] _sectionDefs =
[
    ("1.0", "Introduction", 1), ("1.2", "Background", 2), ("2.0", "Literature Review", 3),
    ("3.1", "Problem Statement", 4), ("3.2", "Justification", 5), ("3.3", "Conceptual Framework", 6),
    ("4.1", "Research Questions", 7), ("4.2", "General Objective", 8), ("4.3", "Specific Objectives", 9),
    ("4.4", "Hypotheses", 10),
    ("5.11", "Ethical Considerations", 11),   // <-- misplaced
];

private static readonly (string Code, string Title, int Order)[] _wizardOnlyDefs =
[
    ("5.1", "Study Area", 20), ("5.2", "Study Design", 21), ... ("5.10", "Data Management", 29),
    ("5.12", "Study Limitations", 30), ("6.1", "Timeline", 31), ...
];
```

`5.11` ("Ethical Considerations") sits in `_sectionDefs` with `Order = 11` — the tail end of the
Sprint-2 "Chapter Writer" block (orders 1–11) — instead of in `_wizardOnlyDefs` alongside its actual
5.x siblings (orders 20–33, where it would need to sit between 5.10's 29 and 5.12's 30). Both
`ExportPartialDocxAsync` (`ResearchService.cs:6005-6009`, `_sectionDefs.Concat(_wizardOnlyDefs)
.OrderBy(d => d.Order)`) and every `DisplayOrder = d.Order` / `def.Order` assignment at section-row
creation (`ResearchService.cs:572, 2046, 2155, 3162`) draw from these same two arrays. That's why the
in-app step list and the exported docx show the identical defect — it isn't an export-only bug.

A one-line code comment at `ResearchService.cs:459-461` shows this exact row was already touched once
before ("Title corrected... this row previously said 'Data Analysis Plan'") without whoever made that
edit noticing the row was also in the wrong array.

**Confirmed against this project's real `project_sections` rows** (`DisplayOrder`, ascending):

```
1.0(1) 1.2(2) 2.0(3) 3.1(4) 3.2(5) 3.3(6) 4.1(7) 4.2(8) 4.3(9) 4.4(10,Status=0/skipped)
5.11(11) 5.1(20) 5.2(21) ... 5.10(29) 5.12(30) 6.1(31) 6.2(32) 6.3(33)
```

Exactly reproduces the reported export order (4.4 doesn't appear in the doc because its `Status = 0`
NotStarted / empty content, correctly skipped by the `!string.IsNullOrWhiteSpace(content)` guard in
`ExportPartialDocxAsync`, not because of the order bug).

**Scope: systemic, not project-specific.** `_sectionDefs`/`_wizardOnlyDefs` are static, project-agnostic
arrays baked into the code and copied onto every new `ProjectSection` row at creation time. Every
project that has ever generated section 5.11 has (or had, until re-viewed) `DisplayOrder = 11` for it —
this affects every exported document and every in-app section list, not just this one.

**"No 1.1" — confirmed intentional, unrelated to the order bug.** Neither the backend arrays nor the
frontend's canonical `src/data/proposalOutline.ts` `STEPS` list (lines 20-43) define a `1.1` code at
all — the outline design goes straight from `1.0 Introduction` to `1.2 Background` in both places,
consistently. Not a second instance of the same defect.

**Frontend canonical order is correct** — `proposalOutline.ts`'s `STEPS` array (lines 20-43) has the
right sequence throughout, including `5.10 → 5.11 → 5.12` in the right place. The defect is confined
to the backend's two-array split; the frontend was never the source of truth for export order (it
doesn't define `4.4` at all, since that's a Sprint-3+ backend-only code) and plays no role in this bug.

**Fix scope**: one-line — move the `("5.11", "Ethical Considerations", 11)` entry out of `_sectionDefs`
into `_wizardOnlyDefs` with an `Order` between 29 and 30 (e.g. renumber 5.10=29, 5.11=29.5-equivalent,
5.12=30, or renumber the whole 20s block to leave a gap). Existing `ProjectSection` rows across all
projects already carry the wrong `DisplayOrder = 11` baked in from creation time, so a data backfill
(`UPDATE project_sections SET "DisplayOrder" = <correct value> WHERE "SectionCode" = '5.11'`) would be
needed alongside the code fix for already-generated projects, not just new ones. Small, well-scoped fix
— but out of scope for this investigation pass.

## Issue 2 — 5.7 citation thinness

**This is not the nanocarriers pattern.** The nanocarriers project (audited in
`pr24-section-5-7-vocabulary-broadening-report.md` / `pr26-part3-section-5-7-framing-investigation.md`)
had a genuinely thin candidate pool — `SelectLiteratureForSection` selected only 6–10 items against an
8-item floor. This project's pool is not thin at all.

**Real numbers, pulled from the actual generation run** (Seq event at `2026-08-06T13:16:50Z`,
correlated to this project via adjacent request-log entries for `20f54592-...` at `13:15:19`–`13:17:20`
around the same section):

```
GenerateSection: theme-selection section=5.7 themes=4 eligible=3402 selected=24 limit=24
```

`SelectLiteratureForSection` filled the full 24-candidate prompt slot (`PromptCandidateLimitForSection`)
out of 3,402 eligible rows — nothing close to a thin pool. For comparison, this same project's other
5.x sections: `5.4` eligible=2425 selected=24; `5.9` eligible=4097 selected=24 (all three hit the
ceiling). PR-24's broadened vocabulary + anchor guard (`ResearchService.cs:1216-1217`,
`ThemeAnchorTerms` at `1601-1626`) is confirmed live/unchanged in the current codebase — it's a
project-agnostic code change and applies here too, but pool *size* was never this project's constraint.

**So the low final citation count (`ResolvedCitationCount = 1`, `WordCount = 384`, `CitationTarget = 8`,
`IsUnderReferenced = true`) is downstream of the drafting step, not the retrieval step.** Pulled both
`RawAiOutput` and the resolved `Content` for this project's 5.7 directly from `project_sections`:

- The drafted prose is exactly what `ResearchPrompts.cs`'s 5.7 guidance asks for — a genuinely
  study-specific description of this project's own dependent/independent/confounding variables
  (detection accuracy, policy derivation feasibility, performance overhead, container runtime
  heterogeneity, etc.). No filler, no fabrication.
- It contains exactly **one** inline citation in the entire section: `(Blum, 2026)`, attached to a
  single framing sentence about operationalizing heterogeneous policy instruments.
- `RawAiOutput`'s own References list cites the *same* Blum paper three times under slightly different
  name formats (`Sonja Blum` / `Blum, S.` ×2) — a formatting artifact, not three distinct sources;
  correctly collapsed to `ResolvedCitationCount = 1` downstream.
- The Blum paper's actual title is *"'Family policy change' and the dependent variable problem: a
  systematic review of theories, conceptualisations, and measurements"* — a public-policy paper, not an
  eBPF/security paper. It was almost certainly selected because its title bag-of-words-matches
  `EvidenceThemesForSection("5.7", ...)`'s "conceptual relationships variable construct" /
  "variable operationalisation" theme phrases on "variable"/"dependent variable problem", not because
  it's topically relevant — the exact same collision class `pr24-section-5-7-vocabulary-broadening-
  report.md` §1 and `pr26-part3-...` already documented for this section's theme vocabulary, now seen
  live in a second, unrelated project.

**Answering the investigation's specific questions:**

1. Thin pool vs. drafting choice: **drafting choice, unambiguously** — 24/24 candidates were selected
   and handed to the prompt; the model used exactly 1.
2. Did PR-24's broadening help this project's pool: it's live and contributed to eligible=3402 being
   as large as it is, but pool size was never the bottleneck here, so the broadening's specific value-add
   isn't visible in this project's outcome one way or the other.
3. PR-25 equivalent (targeted live fetch): **not run for this project, as expected** — PR-25's live
   fetch was nanocarriers-only, and PR-24 Part 2's refined query proposal was explicitly logged as
   "proposed only, not authorized," never implemented as running code. No project has received it.
4. This project's 5.7 thinness is **the same known, already-diagnosed structural gap** identified in
   `pr26-part3-section-5-7-framing-investigation.md` — not a new bug. That report's conclusion was that
   5.7's actual writing task (define this study's own variables) is mostly not a literature-claim task at
   all, so the claim-level evidence apparatus built for it (theme vocabulary tuned in PR-21→24) is
   solving the wrong layer of the problem. This project is a cleaner illustration of exactly that
   conclusion than nanocarriers was: given a large, non-thin, on-theme-by-bag-of-words pool, the model
   still wrote an almost citation-free, correct, self-contained section, and the one citation it did
   reach for is a domain-mismatched bag-of-words hit — not evidence that more/better retrieval would
   help, since retrieval was never the constraint here.

**Secondary observation, not part of the original hypothesis**: `5.4` (`ResolvedCitationCount=4`) and
`5.9` (`=6`) are *also* flagged `IsUnderReferenced = true` against this project's flat 8-source target —
5.7 is the worst of the three (1 vs 4 vs 6) but this project runs under-target across all of 5.x, not
only 5.7. Consistent with the flat `MinUniqueSourcesForSection` floor being unreviewed per-section
(already flagged in-code, `ResearchService.cs:1027-1031`), but a broader pattern than this task scoped
to check — noted, not investigated further here.

## Next steps (not implemented, per scope)

- **Issue 1**: one-line fix (move `5.11` to `_wizardOnlyDefs` with a correct `Order`) plus a data
  backfill for existing `project_sections` rows — small, well-scoped, its own PR.
- **Issue 2**: not a retrieval bug to fix. `pr26-part3-...`'s two proposed fixes (narrow 5.7's theme
  vocabulary to what the section is actually asked to produce, and/or soften the `CITATION MANDATE`'s
  "every factual claim" pressure for this specific section) remain the two live options — this
  investigation adds a second, cleaner real-world data point supporting that report's diagnosis rather
  than surfacing a new problem. Decision on whether to act on it is unchanged from `pr26-part3-...`'s own
  recommendation: a deliberate choice for whoever owns that backlog, not an emergency fix.
