// Research Paper Studio browser smoke (backend docs/research-paper-studio-audit.md). Start a private frontend with its own
// dep cache (so a dev server sharing node_modules is not disturbed), then run the smoke against it:
//   SMOKE_CACHE_DIR=<scratch dir> npx vite --config vite.smoke.config.mjs --host 127.0.0.1
//   RP_SMOKE_ORIGIN=http://127.0.0.1:5192 node scripts/research-paper-studio-smoke.mjs
// Every API response is mocked in memory; no provider or model is called. It walks all seven stages, from a new paper
// to a draft export, and checks the integrity rules the UI is responsible for showing.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.RP_SMOKE_ORIGIN || 'http://127.0.0.1:5192';
const id = 'paper-1';
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const now = new Date().toISOString();
const paper = {
  id, title: 'Sleep and academic performance in secondary school students', paperType: 'LiteratureReview', topic: 'Sleep and academic performance in secondary school students',
  problemStatement: null, researchQuestions: [], objectives: [], scope: null, recommendedApproach: null, questionApproved: false, questionApprovedAt: null,
  academicLevel: 'Masters', discipline: null, citationStyle: 'apa7', targetWords: 4000, minSourceTarget: 8, status: 'Question', progressPercent: 0,
  studentMode: true, evidenceReviewId: 'rev-h', researchProjectId: 'proj-1', sourceCount: 0, revision: 0, createdAt: now, updatedAt: now,
};
const options = {
  paperTypes: [
    { type: 'LiteratureReview', label: 'Literature review', description: 'A synthesis of published research on a question.', defaultTargetWords: 4000, defaultMinSources: 8, requiresResultsInput: false, usesSystematicReviewModule: false },
    { type: 'Empirical', label: 'Empirical paper', description: 'Reports your own study.', defaultTargetWords: 6000, defaultMinSources: 15, requiresResultsInput: true, usesSystematicReviewModule: false },
    { type: 'SystematicReview', label: 'Systematic review', description: 'PRISMA review.', defaultTargetWords: 8000, defaultMinSources: 10, requiresResultsInput: false, usesSystematicReviewModule: true },
  ],
  academicLevels: ['Undergraduate', 'Masters', 'Doctoral'], citationStyles: ['apa7', 'harvard'], minTargetWords: 1500, maxTargetWords: 15000, maxQuestions: 5, maxObjectives: 8,
};
const sources = [
  { id: A, title: 'Sleep duration and grades in adolescents', authors: 'Nakato, J.', year: 2019, journal: 'J Adolesc Health', doi: '10.1000/a', evidenceLevel: 'FullText', verification: 'Verified', verificationNote: null, verifiedAt: now, retrievedFrom: 'OpenAlex', retrievedAt: now, isRetracted: false },
  { id: B, title: 'School start times and attainment', authors: 'Okello, P.; Achieng, M.', year: 2021, journal: 'Sleep', doi: '10.1000/b', evidenceLevel: 'AbstractOnly', verification: 'Mismatch', verificationNote: 'Crossref lists this DOI for a different title.', verifiedAt: now, retrievedFrom: 'PubMed', retrievedAt: now, isRetracted: false },
];
const evidenceStatus = { state: 'BelowTarget', includedSources: 2, candidateSources: 3, minSourceTarget: 8, isCoverageLimit: true,
  message: 'This search found 2 of the 8 sources you asked for. That is a limit of this search, not a gap in the literature.',
  suggestions: [{ code: 'BROADEN_YEARS', message: 'Widen the year range.' }] };
const searchLog = { entries: [
  { query: 'sleep AND academic performance AND adolescents', database: 'OpenAlex', searchedAt: now, resultCount: 3, outcome: 'Results', error: null },
  { query: 'sleep AND academic performance AND adolescents', database: 'PubMed', searchedAt: now, resultCount: 0, outcome: 'Failed', error: 'timeout' },
], totalRecords: 3, uniqueRecords: 3, duplicates: 0, databasesSearched: ['OpenAlex', 'PubMed'], databasesFailed: ['PubMed'], completedAt: now };
const entry = (n, cid, title, state, reason) => ({ position: n, priorityReason: reason, manualDecision: 'Automatic', aiVerdict: state,
  item: { candidateId: cid, title, authors: 'Mwangi, K.', year: '2020', journal: 'Sleep', doi: '', abstract: 'A survey.', state, reasonCode: null, reasonLabel: null, explanation: 'The AI could not tell the age group.', studentNote: null, relevanceScore: 50, evidenceLevel: 'AbstractOnly', inPool: false } });
const screening = { items: [entry(1, 'c1', 'Napping and memory in university students', 'PotentiallyRelevant', 'Needs your decision'), entry(2, 'c2', 'Sleep duration and grades in adolescents', 'Included', 'Likely relevant')],
  totalCount: 2, page: 1, pageSize: 50, stateCounts: { PotentiallyRelevant: 1, Included: 1 }, screeningStatus: 'Completed', screeningProgressPct: 100, canApprove: true, orderSource: 'Ai', orderNote: 'Records the AI could not decide come first.' };
const flow = { recordsIdentified: 3, duplicatesRemoved: 0, recordsScreened: 3, excludedByUser: 1, excludedByAiOnly: 0, excludedByDateRule: 0, userExclusionReasons: {}, awaitingDecision: 0,
  includedFromSearch: 2, includedFromOtherSources: 0, includedTotal: 2, fullText: 1, abstractOnly: 1, metadataOnly: 0, databasesSearched: ['OpenAlex', 'PubMed'], databasesFailed: ['PubMed'],
  methodsText: 'OpenAlex and PubMed were searched; PubMed did not respond. 3 records were screened and 2 included.', caveats: ['PubMed did not respond, so its records are missing, not absent.'] };
const synthesis = { themes: [{ themeId: 't1', title: 'Shorter sleep and lower grades', summary: 'Both studies link shorter sleep to lower grades.', verificationState: 'Verified',
  sources: [{ literatureId: A, title: sources[0].title, authors: 'Nakato, J.', year: 2019, stance: 'Supports', evidenceLevel: 'FullText', design: 'Cohort' }, { literatureId: B, title: sources[1].title, authors: 'Okello, P.', year: 2021, stance: 'Supports', evidenceLevel: 'AbstractOnly', design: null }],
  fullTextSources: 1, abstractOnlySources: 1, stances: { Supports: 2 }, designs: { Cohort: 1 }, pointCounts: { Agreement: 1 }, unverifiedPoints: 1, draftable: true,
  qualityNotes: ['One of the two sources was read from its abstract only, so the theme cannot rest on its methods.'] }],
  researchGaps: [{ id: 'g1', themeId: 't1', gapType: 'Population', explanation: 'No included study covers rural schools.', justification: null, classification: 'ResearchGap', confidence: 'Moderate', status: 'Proposed' }],
  coverageLimits: [{ id: 'g2', themeId: null, gapType: 'Coverage', explanation: 'PubMed did not respond, so clinical studies may be missing.', justification: null, classification: 'CoverageLimit', confidence: 'Low', status: 'Proposed' }],
  sourcesInPool: 2, sourcesInAnyTheme: 2, notes: [] };
const outline = { sections: [
  { code: 'introduction', title: 'Introduction', kind: 'Introduction', purpose: 'Set out the question.', themeIds: ['t1'], targetWords: 600, required: true },
  { code: 'theme-t1', title: 'Shorter sleep and lower grades', kind: 'Theme', purpose: 'Synthesise.', themeIds: ['t1'], targetWords: 1200, required: false },
], totalWords: 1800, approved: false, approvedAt: null, notes: [] };
const claimText = `Shorter sleep went with lower grades {{cite:${A}}}{{cite:${B}}}.`;
const sections = outline.sections.map((s, i) => ({ code: s.code, title: s.title, kind: s.kind, sortOrder: i, generationOrder: i, targetWords: s.targetWords,
  text: `${claimText} {{cite:n:${A}}} followed students for two years. A remembered study {{cite:unknown:S9}}.`, wordCount: 20, status: 'Drafted', failureReason: null,
  flags: [], model: 'claude-sonnet-5-5', draftedAt: now, editedAt: null, versions: 1, mayCite: true }));
const claims = [{ ordinal: 0, text: claimText, origin: 'Literature', support: 'Supported',
  sources: [{ sourceId: A, title: sources[0].title, authors: 'Nakato, J.', year: 2019, evidenceLevel: 'FullText', field: 'findings', passage: 'students sleeping under seven hours had lower grade averages', verdict: 'Supported' }] }];
const finding = (id, severity, code, category, sectionCode, sectionTitle, message, claimText, sourceIds, extra = {}) => ({
  id, sectionCode, sectionTitle, severity, code, category, message, claimText, sourceIds, fixKind: 'None', oneClick: false, status: 'Open', repairAttempts: 0,
  canDismiss: severity !== 'Critical', dismissReason: null, evidence: null, recommendedAction: 'Change the text, then check again.', verification: 'Checked', ...extra });
const partialClaim = `Shorter sleep went with lower grades {{cite:${A}}}{{cite:${B}}}.`;
const integrity = { readiness: { score: 72, ready: false, blocking: 1, warnings: 2, suggestions: 1, sectionsUnverified: 0, byCategory: { References: 1, 'Claim support': 2 }, reasons: ['1 critical problem to fix.'] },
  issues: [
    finding('i1', 'Critical', 'CITATION_OUTSIDE_POOL', 'References', 'theme-t1', 'Shorter sleep and lower grades', "A citation (S9) does not point to one of the paper's sources.", 'A remembered study {{cite:unknown:S9}}.', [], { fixKind: 'RemoveClaim', oneClick: true, recommendedAction: "Remove the claim: it cites something that is not one of the paper's sources.", verification: 'Rule' }),
    finding('i2', 'Important', 'UNCITED_PARAGRAPH', 'Claim support', 'introduction', 'Introduction', 'A paragraph makes claims without citing any source.', 'Sleep shapes learning in many ways.', [], { verification: 'Rule' }),
    finding('i3', 'Important', 'PARTIAL_SUPPORT', 'Claim support', 'theme-t1', 'Shorter sleep and lower grades', 'Only partly supported by the first source.', partialClaim, [A], { evidence: 'students sleeping under seven hours had lower grade averages' }),
    finding('i4', 'Important', 'PARTIAL_SUPPORT', 'Claim support', 'theme-t1', 'Shorter sleep and lower grades', 'Only partly supported by the second source.', partialClaim, [B], { evidence: 'later start times improved attendance' }),
    finding('i6', 'Critical', 'DETAIL_NOT_IN_SOURCE', 'Claim support', 'theme-t1', 'Shorter sleep and lower grades', 'The sentence places the study in China, but no cited source mentions China.', `In China, short sleepers had lower grades {{cite:${A}}}.`, [A], { fixKind: 'RepairSentence', oneClick: true, verification: 'Rule' }),
    finding('i5', 'Suggestion', 'QUOTE_OVERUSE', 'Consistency', 'theme-t1', 'Shorter sleep and lower grades', 'A 31-word direct quotation. Paraphrase it.', null, [], { verification: 'Rule' }),
  ], lastVerifiedAt: now, notice: 'Checked against the passages each claim cites.' };
/** The server's grouping, for the mock: one group per rule and sentence (its sources together), most severe first. */
function withGroups(r) {
  const rank = { Critical: 0, Important: 1, Suggestion: 2 };
  const byKey = new Map();
  for (const i of r.issues.filter(x => x.status !== 'Repaired')) {
    const key = (i.status === 'Dismissed' ? 'd:' : '') + i.code + '|' + i.sectionCode + '|' + (i.claimText ?? i.message);
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  }
  const groups = [...byKey.entries()].map(([key, items]) => ({
    key, severity: items[0].severity, code: items[0].code, category: items[0].category,
    message: items.length === 1 ? items[0].message : `Only partly supported (${items.length} of the sentence's cited sources).`,
    recommendedAction: items[0].recommendedAction, fixKind: items[0].fixKind, oneClick: items[0].oneClick, verification: items[0].verification, count: items.length,
    sectionCodes: [items[0].sectionCode], sentences: items[0].claimText ? [{ sectionCode: items[0].sectionCode, sectionTitle: items[0].sectionTitle, ordinal: 1, text: items[0].claimText }] : [],
    sourceIds: items.flatMap(i => i.sourceIds), evidence: items.map(i => i.evidence).filter(Boolean), issueIds: items.map(i => i.id),
    status: items.every(i => i.status === 'Dismissed') ? 'Dismissed' : items.some(i => i.status === 'Open') ? 'Open' : 'Stale', canDismiss: items.every(i => i.canDismiss),
  })).sort((a, b) => (a.status === 'Dismissed') - (b.status === 'Dismissed') || rank[a.severity] - rank[b.severity]);
  const live = groups.filter(g => g.status !== 'Dismissed');
  return { ...r, groups, summary: { raw: r.issues.filter(i => i.status === 'Open' || i.status === 'Stale').length, groups: live.length,
    critical: live.filter(g => g.severity === 'Critical').length, important: live.filter(g => g.severity === 'Important').length, suggestion: live.filter(g => g.severity === 'Suggestion').length, dismissedCritical: 0 },
    // The last check stopped at its budget: never shown as a finished check.
    verification: { state: 'Incomplete', units: 10, reused: 4, judged: 3, notChecked: 3, failed: 0, invalidated: 1, at: now, message: null },
    state: 'VerificationIncomplete', stateLabel: 'Verification incomplete',
    stateReasons: ['The last check did not reach every claim, so the paper cannot be approved yet. Check again to finish it.'],
    approvals: [{ decision: 'Refused', state: 'CorrectionsRequired', reasons: ['2 critical issues must be fixed before the paper can be approved.'], textHash: 'abc123', at: now }] };
}
const run = kind => ({ id: `run-${kind}`, kind, status: 'Succeeded', stage: `${kind} finished.`, done: 2, total: 2, errorCode: null, errorMessage: null, creditsCharged: 0, startedAt: now, finishedAt: now });
const sent = { patch: null, approveRevision: null, exclude: null, bulk: null, verify: false, dismiss: null, fix: null, export: null };
let listed = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/v1/**', async route => {
  const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method();
  const ok = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  if (p.endsWith('/auth/refresh')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'mock', user: { id: 'u', email: 'test@example.test', name: 'Student', role: 'Admin', plan: 'Pro', wordsUsed: 0, wordsLimit: 100000, creditsUsed: 0, creditsLimit: 1000, isEmailVerified: true, createdAt: '2020-01-01' } }) });
  const base = '/api/v1/research-papers', pb = `${base}/${id}`;
  const bump = patch => { Object.assign(paper, patch, { revision: paper.revision + 1, updatedAt: new Date().toISOString() }); return paper; };
  if (p === '/api/v1/literature-reviews/screening-reasons') return ok([{ code: 'POPULATION', label: 'Wrong population' }, { code: 'DESIGN', label: 'Wrong study design' }]);
  if (p === `${base}/availability`) return ok({ enabled: true });
  if (p === `${base}/options`) return ok(options);
  if (p === base && m === 'GET') return ok(listed);
  if (p === base && m === 'POST') { const b = req.postDataJSON(); Object.assign(paper, { topic: b.topic, title: b.topic, paperType: b.paperType }); listed = [paper]; return ok(paper); }
  if (p === pb && m === 'GET') return ok(paper);
  if (p === pb && m === 'PATCH') { sent.patch = req.postDataJSON(); const b = sent.patch; return ok(bump({ researchQuestions: b.researchQuestions ?? paper.researchQuestions, objectives: b.objectives ?? paper.objectives, scope: b.scope ?? paper.scope, problemStatement: b.problemStatement ?? paper.problemStatement })); }
  if (p === `${pb}/question/approve`) { sent.approveRevision = req.postDataJSON().revision; return ok(bump({ questionApproved: true, questionApprovedAt: now, status: 'Evidence', progressPercent: 15 })); }
  if (p === `${pb}/evidence-status`) return ok(evidenceStatus);
  if (p === `${pb}/search-log`) return ok(searchLog);
  if (p === `${pb}/sources/verify`) { sent.verify = true; return ok(run('VerifySources')); }
  if (p === `${pb}/sources`) return ok(sources);
  if (p === `${pb}/criteria` && m === 'GET') return ok({ include: ['Secondary school students'], exclude: ['University students'], yearFrom: 2010, yearTo: null, version: 1 });
  if (p === `${pb}/screening` && m === 'GET') return ok(screening);
  if (p === `${pb}/screening/bulk`) { sent.bulk = req.postDataJSON(); return ok({ updated: sent.bulk.candidateIds.length, failed: [] }); }
  if (p === `${pb}/screening/flow`) return ok(flow);
  if (p === `${pb}/screening/audit`) return ok({ items: [{ candidateId: 'c1', title: 'Napping and memory in university students', actor: 'User', decision: 'Exclude', reasonCode: 'POPULATION', reasonLabel: 'Wrong population', note: null, aiVerdict: 'PotentiallyRelevant', criteriaVersion: 1, at: now }], totalCount: 1 });
  if (p === `${pb}/screening/approve` && !req.postDataJSON()?.keepMostRelevant) { sent.overLimit = true; return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, code: 'TOO_MANY_FOR_SYNTHESIS', error: '71 sources are included, but the synthesis can compare at most 40. Take some out, or keep the 40 most relevant.' }) }); }
  if (p === `${pb}/screening/approve`) return ok({ paper: bump({ status: 'Synthesis', sourceCount: 2, progressPercent: 40 }), addedToPool: 2, excludedForDateRange: 0, poolSize: 2 });
  if (p.startsWith(`${pb}/screening/`) && m === 'PATCH') { sent.exclude = req.postDataJSON(); return ok(null); }
  if (p === `${pb}/synthesis/table`) return ok(synthesis);
  if (p === `${pb}/synthesis/run`) return ok(null);
  if (p === `${pb}/outline/approve`) { Object.assign(outline, { approved: true, approvedAt: now }); bump({ status: 'Writing', progressPercent: 60 }); return ok(outline); }
  if (p === `${pb}/outline`) return ok(outline);
  if (p === `${pb}/sections`) return ok(outline.approved ? sections : []);
  if (p.match(/\/sections\/[^/]+\/claims$/)) return ok(claims);
  if (p === `${pb}/integrity`) return ok(withGroups(integrity));
  if (p.startsWith(`${pb}/issues/`) && p.endsWith('/dismiss')) { sent.dismiss = req.postDataJSON(); const i = integrity.issues.find(x => p.includes(`/${x.id}/`)); Object.assign(i, { status: 'Dismissed', dismissReason: sent.dismiss.reason }); return ok(i); }
  if (p.startsWith(`${pb}/issues/`) && p.endsWith('/fix')) { sent.fix = p; Object.assign(integrity.issues[0], { status: 'Stale' }); return ok({ action: 'Edited', run: null, section: null }); }
  if (p === `${pb}/repair`) { sent.repair = req.postDataJSON(); return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...run('RepairSentences'), status: 'Running', stage: 'Repairing 1 sentence(s)', finishedAt: null } }) }); }
  if (p === `${pb}/runs/latest`) return ok(null);
  if (p === `${pb}/export`) { sent.export = Object.fromEntries(url.searchParams); return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: 'PK mock docx' }); }
  return ok([]);
});
await page.addInitScript(() => { localStorage.setItem('humaniser-onboarding-seen', 'true') });
const must = async (cond, message) => { if (!(await cond)) throw Error(message); };

// List, then a new paper. A systematic review is sent to its own workspace.
await page.goto(`${origin}/app/research-paper`);
const skip = page.getByRole('button', { name: 'Skip', exact: true });
if (await skip.waitFor({ timeout: 5000 }).then(() => true, () => false)) await skip.click();
await page.getByRole('heading', { name: 'Research papers' }).waitFor();
await page.getByText('No papers yet').waitFor();
await page.getByRole('button', { name: 'New paper' }).click();
await page.getByLabel('Type of paper').selectOption('SystematicReview');
await page.getByText('is written in the').waitFor();
await page.getByLabel('Type of paper').selectOption('LiteratureReview');
await page.getByLabel('Topic').fill(paper.topic);
await page.getByRole('button', { name: 'Create paper' }).click();
await page.getByRole('heading', { name: paper.title }).waitFor();

// 1 Question: approving saves the edited questions first, with the revision the approval is for.
await page.getByText("You are responsible for this paper").waitFor();
await page.getByLabel('Research questions 1', { exact: true }).fill('How does sleep duration relate to grades in secondary school students?');
await page.getByRole('button', { name: 'Approve the question' }).click();
await page.getByRole('heading', { name: 'Search', exact: true }).waitFor();
await must(sent.patch?.researchQuestions?.length === 1, 'The edited question was not saved before approval');
await must(sent.approveRevision === 1, `The approval was not sent for the saved revision (got ${sent.approveRevision})`);

// 2 Sources: too few sources is a limit of the search; a database that did not answer is shown; DOI states shown.
await page.getByText('That is a limit of this search, not a gap in the literature.').first().waitFor();
await page.getByText('Did not answer').waitFor();
await page.getByText('DOI belongs to another work').waitFor();
await page.getByText('Crossref lists this DOI for a different title.').waitFor();
await must(page.getByRole('button', { name: 'Extract evidence' }).isDisabled(), 'Extraction was possible without consent');
await page.getByRole('button', { name: 'Check DOIs' }).click();
await page.getByText('VerifySources finished.').waitFor();
await must(sent.verify, 'The DOI check was not started');
await page.getByRole('button', { name: 'Continue to screening' }).click();

// 3 Screening: an exclusion needs a reason and sends it; bulk include; the audit trail; approve (gate 2).
await page.getByRole('heading', { name: 'Screening', exact: true }).waitFor();
const exclude = page.getByRole('button', { name: 'Exclude', exact: true }).first();
await must(exclude.isDisabled(), 'Exclude was enabled before a reason was chosen');
await page.getByLabel('Reason for excluding').first().selectOption('POPULATION');
await exclude.click();
await page.waitForTimeout(200);
await must(sent.exclude?.decision === 'exclude' && sent.exclude?.reasonCode === 'POPULATION', 'The exclusion was not sent with its reason');
await page.getByLabel('Select Napping and memory in university students').check();
await page.getByLabel('Select Sleep duration and grades in adolescents').check();
await page.getByRole('region', { name: 'Bulk actions' }).getByRole('button', { name: 'Include', exact: true }).click();
await page.waitForTimeout(200);
await must(sent.bulk?.decision === 'include' && sent.bulk?.candidateIds.length === 2, 'The bulk decision was not sent for both records');
await page.getByText('PubMed did not respond, so its records are missing, not absent.').waitFor();
await page.getByRole('button', { name: 'Show', exact: true }).click();
await page.getByText('You: excluded “Napping and memory in university students” (Wrong population)', { exact: false }).waitFor();
await page.getByRole('button', { name: 'Approve and continue' }).click();
// More sources than the synthesis compares: refused with the numbers, and the way forward offered.
await page.getByText('71 sources are included, but the synthesis can compare at most 40.', { exact: false }).waitFor();
await must(sent.overLimit, 'The over-limit refusal was not exercised');
await page.getByRole('button', { name: 'Keep the most relevant and approve' }).click();

// 4 Synthesis: the table, a research gap apart from a limit of the search.
await page.getByRole('heading', { name: 'Shorter sleep and lower grades' }).waitFor();
await page.getByText('Can be drafted').waitFor();
await page.getByText('1 statement failed the evidence check', { exact: false }).waitFor();
await page.getByText('Limits of this search (not gaps in the literature)').waitFor();
await page.getByText('No included study covers rural schools.').waitFor();
await page.getByRole('button', { name: 'Continue to writing' }).click();

// 5 Writing: approve the outline (gate 3); citations open their passage; unknown citation flagged; editing shows markers.
await page.getByRole('heading', { name: 'Outline', exact: true }).waitFor();
await page.getByRole('button', { name: 'Approve the outline' }).click();
await page.getByRole('heading', { name: 'Draft', exact: true }).waitFor();
await page.getByRole('heading', { name: 'Introduction', level: 2 }).waitFor();
await page.getByText('[citation not in this paper]').first().waitFor();
await page.getByRole('button', { name: 'Nakato (2019)' }).first().waitFor();
await page.getByRole('button', { name: '(Nakato, 2019)' }).first().click();
await page.getByText('students sleeping under seven hours had lower grade averages').waitFor();
await page.getByText('Checked: supported').waitFor();
await page.getByRole('toolbar', { name: 'Actions for Introduction' }).getByRole('button', { name: 'Edit' }).click();
const editor = page.getByLabel('Text of Introduction');
const editable = await editor.inputValue();
await must(editable.startsWith('Shorter sleep went with lower grades [1][2]. [@1] followed'), `Citations were not shown as numbered markers while editing: ${editable}`);
await page.getByRole('button', { name: 'Discard changes' }).click();
await page.getByRole('button', { name: 'Continue to the integrity check' }).click();

// 6 Integrity check: status and counts; one sentence's findings across its sources are one issue; a critical issue cannot be
// dismissed; an important one needs a reason; suggestions are collapsed; filters; the link to the section; a fix awaits a check.
await page.getByRole('heading', { name: 'Integrity check', exact: true }).waitFor();
await page.getByText('Verification incomplete', { exact: true }).waitFor();
await page.getByText('3 claim checks were not reached').waitFor();
await page.getByText('3 claim checks made now, 4 reused from earlier checks').waitFor();
// The gate: no approval while the check is incomplete; the reason is shown, and the refused decision is in the history.
await page.getByText('The paper cannot be approved yet:').waitFor();
await must((await page.getByRole('button', { name: 'Approve for final export' }).count()) === 0, 'Approval was offered on an incomplete check');
await page.getByText('Decision history (1)').click();
await page.getByText('Refused · 2 critical issues must be fixed').waitFor();
await page.getByText('2 critical', { exact: true }).waitFor();
await page.getByText('6 findings, grouped into 5 issues.').waitFor();
// Critical sentences can be repaired automatically: one request for all of them.
await page.getByText('1 critical issue can be repaired automatically').waitFor();
await page.getByRole('button', { name: 'Repair automatically' }).click();
await page.getByText('Repairing: Repairing 1 sentence(s)').waitFor();
await must(Array.isArray(sent.repair?.issueIds), 'The repair was not requested');
const issues = page.getByRole('heading', { name: 'Issues', exact: true }).locator('xpath=ancestor::section[1]');
await issues.getByText("Only partly supported (2 of the sentence's cited sources).").waitFor();
await must(!(await page.getByText('A 31-word direct quotation. Paraphrase it.').isVisible()), 'A suggestion was shown before it was opened');
await page.getByRole('button', { name: /1 suggestion \(optional\)/ }).click();
await page.getByText('A 31-word direct quotation. Paraphrase it.').waitFor();
const partialRow = issues.locator('li', { hasText: "Only partly supported (2 of the sentence's cited sources)." });
await partialRow.getByRole('button', { name: 'Details' }).click();
await page.getByText('later start times improved attendance').waitFor();
const criticalRow = issues.locator('li', { hasText: 'does not point to one of the paper' });
await must((await criticalRow.getByRole('button', { name: 'Dismiss', exact: true }).count()) === 0, 'A critical issue offered Dismiss');
await page.getByLabel('Severity').selectOption('Critical');
await must((await issues.locator('li', { hasText: 'A paragraph makes claims' }).count()) === 0, 'The severity filter did not filter');
await page.getByLabel('Severity').selectOption('');
const uncited = issues.locator('li', { hasText: 'A paragraph makes claims' });
await uncited.getByRole('button', { name: 'Dismiss', exact: true }).click();
await page.getByLabel('Why does this not apply?').fill('short');
await must(page.getByRole('button', { name: 'Dismiss with this reason' }).isDisabled(), 'A dismissal was allowed without a real reason');
await page.getByLabel('Why does this not apply?').fill('I checked the full text of this source myself.');
await page.getByRole('button', { name: 'Dismiss with this reason' }).click();
await page.getByRole('heading', { name: 'Dismissed' }).waitFor();
await must(sent.dismiss?.reason === 'I checked the full text of this source myself.', 'The dismissal reason was not sent');
await criticalRow.getByRole('button', { name: 'Remove the claim' }).click();
await page.getByText('Edited. Check the paper again to confirm the fix.').waitFor();
await must(sent.fix?.endsWith('/issues/i1/fix'), 'The one-click fix was not sent');
await page.getByText('Changed: check again to confirm').waitFor();
await issues.locator('li', { hasText: 'does not point to one of the paper' }).getByRole('button', { name: 'Open the section' }).click();
await page.waitForURL(/stage=writing&section=theme-t1/);
await page.goBack();
await page.getByRole('heading', { name: 'Integrity check', exact: true }).waitFor();
await page.getByRole('button', { name: 'Continue to export' }).click();

// 7 Export: a paper that is not ready exports only as a marked draft.
await page.getByRole('heading', { name: 'Export', exact: true }).waitFor();
const word = page.getByRole('button', { name: 'Word (draft)' });
await word.waitFor();
const download = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await word.click();
const file = await download;
await must(sent.export?.format === 'docx' && sent.export?.draft === 'true' && sent.export?.aiStatement === 'true', `The export was not requested as a draft with appendices: ${JSON.stringify(sent.export)}`);
await must(file?.suggestedFilename().includes('(draft)'), `The downloaded file was not named as a draft: ${file?.suggestedFilename()}`);

await page.screenshot({ path: join(tmpdir(), 'humaniser-research-paper-desktop.png'), fullPage: true });
// Phone width, on the busiest stages.
await page.setViewportSize({ width: 390, height: 844 });
for (const stage of ['check', 'export', 'writing', 'screening', 'synthesis', 'evidence']) {
  await page.goto(`${origin}/app/research-paper/${id}?stage=${stage}`);
  await page.getByRole('heading', { name: paper.title }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(tmpdir(), `humaniser-research-paper-mobile-${stage}.png`), fullPage: true });
  const culprits = await page.evaluate(() => {
    if (document.documentElement.scrollWidth <= window.innerWidth + 1) return [];
    return [...document.querySelectorAll('body *')].filter(e => {
      if (e.getBoundingClientRect().right <= window.innerWidth + 1 || getComputedStyle(e).position === 'fixed') return false;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(a).overflowX)) return false;
      return true;
    }).slice(0, 8).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 80)} right=${Math.round(e.getBoundingClientRect().right)}`);
  });
  if (culprits.length) throw Error(`The ${stage} stage scrolls sideways at phone width:\n${culprits.join('\n')}`);
}
if (errors.length) throw Error(errors.join('\n'));
console.log('Research Paper Studio smoke passed: create (SR redirect shown), question saved and approved with its revision, sources (coverage limit, database down, DOI mismatch, consent), screening (reasoned exclusion, bulk, audit, approve), synthesis (gap vs search limit), writing (outline gate, citation evidence, unknown citation, numbered editing), integrity (an incomplete check said so and could not be approved, automatic repair started, grouped issues and counts, suggestions collapsed, filters, no dismiss for critical, reasoned dismissal, fix awaits a check, link to the section), draft-only export; desktop and 390px on six stages.');
await browser.close();
