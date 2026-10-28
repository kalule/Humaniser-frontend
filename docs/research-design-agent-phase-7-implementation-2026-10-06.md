# Research Design — Phase 7 implementation

Date: 2026-10-06. Scope: student UX in the existing Humaniser frontend. Implementation stops at Phase 7. No proposal generation integration, backend changes, new intelligence, provider calls, or migrations.

## A. Phase 6 verification

Read the Phase 6 report, API reference and live DTO/application sources. The preceding backend result was 932 passing tests; it was not rerun in this frontend-only phase. Checked actual routes, command payloads, allowed actions, progress, question schemas, evidence statuses, readiness, acceptance, history, and cancellation. CodeGraph was consulted first and successfully mapped the app shell, navigation and dependencies; targeted source reads filled in omitted sections. Existing dirty changes in both repositories were preserved.

## B. Existing frontend infrastructure reused

| Concern | Existing owner reused |
|---|---|
| Authentication / layout | ProtectedRoute, AppShell, AppNavbar, existing Sidebar and account controls |
| Navigation / titles | NAV_SECTIONS unchanged; existing NON_NAV_PAGES title lookup extended |
| Routing / errors | Existing lazy routes, Suspense loader and ChunkErrorBoundary |
| Server state | Existing TanStack Query provider; account/project-scoped keys |
| API / auth / billing | Existing Axios client, envelope unwrapping, token refresh, billing/rate-limit handling |
| Controls | Existing Button, Card, Input, Modal and Skeleton |
| Visual language | Existing app CSS surface/text/purple/border tokens, spacing and responsive utilities |
| Notifications | Existing global react-hot-toast handling; no new notification provider |

No shared control was replaced or globally restyled. Existing editor/document, Proposal Studio, Thesis Studio, setup/recommendation and submission-review surfaces were inspected. Their generation/editor behavior is unchanged.

## C. UX audit findings

| Classification | Finding / decision |
|---|---|
| EXISTS | Authenticated shell, project dashboard entry point, typography/spacing tokens, buttons, panels, dialogs, forms, skeletons, mobile shell, queries, API auth, notifications and error boundary |
| PARTIAL | Legacy generic controls still use dark utility defaults despite the current light shell; a workspace-scoped token adapter preserves shared consumers |
| PARTIAL | Existing methodology suggestion/setup and specification editor are separate legacy workflows; the new page clearly consumes the Phase 6 view |
| MISSING | Guided Research Design workspace, typed question journey, backend-action UI and lazy run history |
| DUPLICATED | Legacy methodology/analysis representations remain existing compatibility features; Phase 7 does not introduce another authoritative store or remove consumers |
| SHOULD REUSE | Existing app infrastructure and canonical specification editor for unsupported structural clarification |
| SHOULD REMOVE | Nothing proven safe to remove in this frontend-only phase |

Alerts use semantic inline regions rather than a new alert primitive. Native details/summary provide progressive disclosure instead of adding tab/navigation infrastructure. Native labelled selects and textarea match existing form tokens. No feature-flag or product-event infrastructure was found to reuse; neither was introduced.

## D. Files changed

New application files:

- `src/types/researchDesign.ts`: product view and typed commands.
- `src/api/researchDesign.ts`: eight Phase 6 client operations.
- `src/lib/researchDesign.ts`: presentation copy, safe errors, and polling schedule only.
- `src/pages/app/ResearchDesignPage.tsx`: guided workspace and command handling.
- `src/components/research-design/ResearchDesignQuestion.tsx`: one supported question at a time.
- `src/components/research-design/ResearchDesignReview.tsx`: recommendation and expandable research details.
- `src/components/research-design/researchDesign.css`: scoped mapping from legacy control utilities to existing app tokens.

Shared changes: two lazy-route lines in `src/App.tsx`; one title record in `src/config/navigation.ts`; one Research Design entry button and wrapping toolbar in `src/pages/app/ResearchDashboardPage.tsx`. These files already contained unrelated changes. The existing title/navigation tests and whole frontend test suite were run. Sidebar, AppShell, global styles, shared components, API client, dependency files and generation code were not modified.

Tests/artifacts: `src/api/researchDesign.test.ts`, `src/lib/researchDesign.test.ts`, `src/components/research-design/ResearchDesignReview.test.tsx`, LMS JSON fixture, `scripts/research-design-smoke.mjs`, JSON test reports, build output and screenshots under `docs/research-design-phase7/`.

## E. Routes/navigation

Authenticated lazy route: `/app/research-design/:projectId`. Enter through **Research Design** in the existing research-project dashboard, reached from Proposal Studio. Breadcrumbs return to Proposal Studio or the project. No new dashboard, sidebar, shell, navigation definition, or project creation flow. The app header/browser title uses the existing source of truth. No automatic invocation from Proposal Studio.

## F. Workspace architecture

One existing-shell workspace with a header and one main panel. Server state stays in Query; answer text, disclosure/dialog/history selection and pending/error state remain local. Only the backend view supplies academic state, legal commands, findings and readiness. No manually synchronized global Research Design store.

## G. State rendering

Not started explains the purpose and offers Build only when advertised. Durable stages use human-readable copy. RequiresInput prioritizes one answerable question. RequiresEvidence distinguishes active checking from unresolved work. Review and accepted states show the design; failed/cancelled/budget-limited and earlier states retain saved-work context and only advertised actions. Unknown specialist questions remain visible and link to the existing specification workflow.

## H. Progress experience

Uses the server's current stage, elapsed seconds and revalidation flag. No invented stage completion ticks, percentage, ETA, readiness score, model/provider labels or internal budgets. Active work explains that the student can leave and return. Queued work is already started; the UI does not enqueue it again.

## I. RequiresInput UX

Labelled short-text input, longer contextual textarea for research problem/sampling rationale, or three explicit yes/no access choices. Negative answers are preserved. Server maxLength and answerable/valueType control the supported interaction. One question and a concise reason; unsupported schemas have no submission button. No arbitrary JSON editing, fabricated choices, or new methodology rules. Number/date/multiple-choice questions are not currently exposed by Phase 6 and are not invented here.

## J. Evidence UX

Secondary expandable evidence lists show supplied decision labels/reasons, status, linked-reference counts and limitations. No abstracts/corpus are fetched. The v1 view does not supply source metadata/URLs; the UI does not invent citations or expand evidence counts into claims that all sources were verified. Source-specific navigation requires a future explicit contract.

## K. Uncertain evidence

Contradiction takes precedence over a Supported display and remains “Evidence is mixed.” Insufficient evidence says more evidence is needed, never research-gap discovery. ProviderUnavailable says the check could not finish, never that no literature exists. Stale support needs checking again. Backend actions remain the only command authority.

## L. Recommended design

Prominent approach and concise supplied rationale, then population, sampling, data collection and analysis. Full design expands RQs, objectives, sample assumptions/approximation, constructs, instruments, analysis assumptions/missingness, applicable qualitative/mixed plans, ethics and feasibility. No confidence score or invented psychometric validity badge.

## M. Alternatives

Secondary disclosure appears only when supplied candidates exist. Shows rationale, advantages and trade-offs; it does not pretend the API can accept a client-selected alternative.

## N. Alignment

Expandable readable question → objective → data → analysis → expected output. Stable IDs resolve to labels; IDs are not displayed. Missing links stay explicit. Derived rows are not turned into a fabricated “Aligned” certification independent of backend findings.

## O. Findings

Non-pass findings are ordered for review. Severity becomes Must fix / Important / Suggested improvement / Check. Observations and repair guidance remain visible, rule IDs stay out of ordinary display. No unsupported automatic repair action.

## P. Readiness

Displays the server readiness status without a score. Acceptance visibility follows allowedActions, including when status appears ready but Accept is absent. The UI never calculates permission from finding counts, confidence, or local methodology knowledge.

## Q. Acceptance

Existing accessible Modal explains accepted-version and future-revision consequences. Sends only idempotencyKey, expectedVersion and expectedSpecificationRevision. Server response supplies Accepted; no optimistic academic state. Double submissions are synchronously guarded. A 409 requires deliberate refresh and renewed review, never an automatic acceptance retry. A 422 returns to review without faking success.

## R. Revision

An advertised Revise command explains that the accepted version remains unchanged until a successor is accepted, with a credit-use note. Sends the existing revision command. Phase 6 does not expose editable change constraints or a revision impact preview, so these are not fabricated; structural edits remain in the existing specification workflow.

## S. History

Lazy bounded pages, optional owned run view in a read-only modal. Uses actual statuses/dates, not invented v1/v2 numbering. Optional history failure does not disable the main workspace. No history fetched on initial load.

## T. API client

Uses actual `/api/v1/research/projects/{projectId}/design` routes and the existing client. Supports abort signals on reads, safe UUID/path encoding and typed start/input/accept/revise/cancel/current/run/history payloads. Backend API contracts unchanged.

## U. Allowed actions

Only advertised mutating actions render; ProvideInput additionally needs the advertised supported schema. Presentation chooses button labels/priority. View is read navigation; historical views expose no commands. Every command still revalidates on the server. Frontend pending/error blocking is interaction safety, not an academic readiness rule.

## V. Polling/server state

Eight-second active polling, paused in background, refetch on focus, stopped for stable/terminal/input states or read failure. RequiresEvidence continues for actual Queued/Investigating/ResolvingEvidence/AwaitingInvestigation/Waiting/Stopping statuses and stops when all work is settled. The scheduling classifier grants no actions. Owner/project keys, route remount on account/project change and abortable reads prevent cross-project UI state reuse. No WebSocket/SSE stack.

## W. Concurrency/idempotency

No command is automatically retried against newer state. A synchronous ref lock prevents double clicks before React re-renders. Exact-command keys survive reload through sessionStorage; only a SHA-256 command digest and random UUID are retained, not answers or tokens. Blocked storage uses in-memory keys. Mutations never blindly overwrite another project's view; a successful response cancels older current-view reads before caching server state.

## X. Responsive behavior

Single column on mobile, two summary columns from the existing small breakpoint, wrapping actions, word-breaking research content and vertical alignment rather than wide tables. Browser checks covered 390/768/1280 px and acceptance-dialog width. Existing project toolbar wraps to accommodate the entry button. Existing mobile sidebar/navbar/bottom tabs remain unchanged.

## Y. Accessibility

Existing Modal provides dialog name, Escape and focus trap; acceptance restores trigger focus where it remains mounted. Inputs have labels, required/length constraints, reason/error associations; guided question receives focus. Semantic headings, dl/list/details elements, textual severities, polite live status, alert errors, visible token focus outlines and 44px workspace control targets. Scoped reduced-motion support. Browser keyboard input and Escape/focus restoration tested. This is not a formal WCAG certification or exhaustive assistive-technology audit.

## Z. Error handling

Safe actionable copy for normalized shared-client codes, conflict/billing/rate-limit/schema/gate errors and unknown failures; optional correlation reference. No raw server message, stack trace or provider output. Saved state stays visible; refresh is explicit. Existing page/chunk boundary reused; history failure remains local.

## AA. Analytics/flags

No new analytics provider, feature-flag service or research-content logging. No relevant existing rollout/event mechanism found. Existing authentication gates the route; controlled deployment remains an operational decision.

## AB. Tests added

**309 frontend Vitest tests passed; 32 new Phase 7 tests** over the 277-test baseline. Zero failures/skips. New tests cover the client, envelopes/payloads, polling actual stages, safe errors, evidence uncertainty, shared title source, typed controls, bounded fields, alternatives and alignment. Existing 39 test files remained green; total is now 42.

## AC. Golden user journey

Mocked API through the real authenticated application, client, Query and React route: open → Build → queued → refresh recovery → one population question → typed answer → evidence investigation → actual polling to review → expand design/alignment/evidence/alternatives → acceptance confirmation → Accepted → refresh. **41 browser assertions passed**, zero failures/skips/page errors. Includes double clicks, 409 and 422, exact-key reuse, access booleans, cancellation, restart, optional history failure and read-only history. No live backend/provider dependency.

## AD. LMS fixture

Test-only quantitative association/cross-sectional LMS-usability/student-satisfaction scenario covers population, stratified sampling, measurement, analysis, ethics, alignment and evidence limitations. Loaded only by test files/script; no production component imports fixture data. No hardcoded LMS methodology in production.

## AE. Build/typecheck/lint

Production `npm.cmd run build` passes TypeScript and Vite. Existing large-chunk and mixed static/dynamic import warnings remain. A restricted-filesystem esbuild ancestor-read failure was resolved by running the authorized build with the required filesystem access; it was not a TypeScript defect. Lint **could not run**: the checkout's existing npm lint script references ESLint, but its executable/dependencies are not installed. Lint error count is therefore **unknown**, not zero; no unrelated dependency/configuration repair was made.

## AF. Backend/regression scope

Backend code changed: **no**. API contract changed: **no**. Backend tests rerun this phase: **0**; prior Phase 6 result 932 is historical evidence only. Migration created/applied: **0/0**. Development database changed: **no**. Live model calls: **0**. Live literature-provider calls: **0**. No backend restart or deployment.

## AG. Known limitations

- Seven current scalar/access clarification fields only; unsupported structural questions use the existing specification workflow.
- Source-level metadata/links, constraint editing and dependency impact preview are absent from the v1 view; not simulated.
- Existing strict setup requirements and required Phase 4/5 deployed migrations still apply. No migration was applied to make a live endpoint available here.
- Browser verification uses intercepted API responses; production backend/queue/network behavior is covered by earlier backend phases, not claimed by these browser tests.
- Full lint and formal accessibility/production performance evaluation remain unverified.

## AH. Visual results

Existing sidebar/header, neutral app background, one white bordered panel, purple primary actions, regular academic typography. Recommendation remains concise; disclosures contain detailed material. Input is one focused question. Confirmation uses the existing modal. Screenshots: `docs/research-design-phase7/not-started-desktop.png`, `ready-desktop.png`, `accepted-desktop.png`, and `ready-390.png`, `ready-768.png`, `ready-1280.png`. Browser screenshot review corrected legacy dark surfaces and control colors with scoped token mapping.

## AI. Recommended Phase 8 scope

Bind Proposal Studio consumption to the accepted canonical revision and evidence provenance, integrate explicit design/prose drift handling, and retain generation fences. Do not infer readiness in React or silently regenerate chapters. Phase 8 is **not started**.
