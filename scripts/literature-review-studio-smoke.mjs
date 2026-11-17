// Literature Review Studio browser smoke (docs/OPEN_ITEMS.md #113). Run against a local frontend:
//   LR_SMOKE_ORIGIN=http://127.0.0.1:5191 node scripts/literature-review-studio-smoke.mjs
// Every API response is mocked in memory; no provider or model is called.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.LR_SMOKE_ORIGIN || 'http://127.0.0.1:5191';
const id = 'rev-1';
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
const now = new Date().toISOString();
const review = { id, title: 'Social media and adolescent anxiety', question: 'How does social media use relate to anxiety in adolescents?', reviewType: 'Thematic', status: 'Scoping', currentStep: 0, sourceCount: 0, progressPercent: 0, createdAt: now, updatedAt: now, academicLevel: 'Masters', discipline: null, citationStyle: 'apa7', targetWords: 3000, yearFrom: 2010, yearTo: null, criteria: { include: [], exclude: [] }, researchProjectId: 'proj-1', literatureMatrixId: null, revision: 0 };
const pool = [
  { id: A, title: 'Cohort study of teen social media use', authors: 'Nakato, J.', year: 2019, journal: 'J Youth', doi: null, evidenceLevel: 'AbstractOnly', origin: 'Library' },
  { id: B, title: 'School survey of anxiety and screen time', authors: 'Okello, P.', year: 2021, journal: 'J Youth', doi: null, evidenceLevel: 'AbstractOnly', origin: 'Search' },
];
const counts = { NotScreened: 0, Included: 1, AwaitingFullText: 0, PotentiallyRelevant: 1, NotRelevant: 0, Excluded: 0, UnableToAssess: 0 };
const screeningItems = [
  { candidateId: 'c1', title: 'Online platforms and teenage worry', authors: 'Achieng, M.', year: '2020', journal: 'Youth', doi: '', abstract: 'A survey.', foundVia: ['openalex'], state: 'PotentiallyRelevant', reasonCode: null, reasonLabel: null, explanation: 'Unclear population.', studentNote: null, relevanceScore: 55, topicMatchScore: 40, evidenceLevel: 'AbstractOnly', hasFullText: false, inPool: false },
  { candidateId: 'c2', title: 'School survey of anxiety and screen time', authors: 'Okello, P.', year: '2021', journal: 'J Youth', doi: '', abstract: 'A survey.', foundVia: ['openalex'], state: 'Included', reasonCode: null, reasonLabel: null, explanation: 'On the question.', studentNote: null, relevanceScore: 90, topicMatchScore: 80, evidenceLevel: 'AbstractOnly', hasFullText: false, inPool: true },
];
const theme = { id: 't1', title: 'Heavier use and anxiety', summary: 'Two studies link heavier use to anxiety.', sortOrder: 0, origin: 'Ai', verificationState: 'Verified', failureReason: null,
  sources: [{ literatureId: A, title: pool[0].title, authors: 'Nakato, J.', year: 2019, stance: 'Supports' }, { literatureId: B, title: pool[1].title, authors: 'Okello, P.', year: 2021, stance: 'Supports' }],
  points: [{ id: 'p1', kind: 'Agreement', text: 'Both studies link heavier use to anxiety.', sourceIds: [A, B], evidence: [{ source: A, field: 'findings', quote: 'adolescents who used social media for more than three hours a day' }], verified: true, failureReason: null },
           { id: 'p2', kind: 'Trend', text: 'Over 50% were anxious.', sourceIds: [B], evidence: [], verified: false, failureReason: 'The number 50% is not in any of its quotes.' }] };
const outline = { sections: [{ code: 'introduction-introduction', title: 'Introduction', kind: 'Introduction', purpose: 'Set out the question.', themeIds: ['t1'], targetWords: 600 }, { code: 'theme-heavier-use-and-anxiety', title: 'Heavier use and anxiety', kind: 'Theme', purpose: 'Synthesise.', themeIds: ['t1'], targetWords: 1200 }], totalWords: 1800 };
const sections = outline.sections.map((s, i) => ({ code: s.code, title: s.title, kind: s.kind, sortOrder: i, status: 'Drafted', failureReason: null, text: `Heavier social media use goes with anxiety {{cite:${A}}}{{cite:${B}}}. A remembered study {{cite:unknown:S9}}.`, wordCount: 12, targetWords: s.targetWords, citedSourceIds: [A, B], unknownCitations: ['S9'], draftedAt: now, editedAt: null }));
const issues = { issues: [{ id: 'i1', sectionCode: 'theme-heavier-use-and-anxiety', severity: 'Blocking', code: 'CITATION_OUTSIDE_POOL', message: 'A citation (S9) does not point to a source in this review.', claimText: null, sourceIds: [], status: 'Open', repairAttempts: 0, canDismiss: false, dismissReason: null, createdAt: now }], readiness: { ready: false, blockingOpen: 1, warningsOpen: 0, notDrafted: [], notVerified: [] } };
let decided = null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/v1/**', async route => {
  const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method();
  const ok = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  if (p.endsWith('/auth/refresh')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'mock', user: { id: 'u', email: 'test@example.test', name: 'Student', role: 'Admin', plan: 'Pro', wordsUsed: 0, wordsLimit: 100000, creditsUsed: 0, creditsLimit: 1000, isEmailVerified: true, createdAt: '2020-01-01' } }) });
  const base = '/api/v1/literature-reviews';
  if (p === `${base}/availability`) return ok({ enabled: true });
  if (p === `${base}/options`) return ok({ reviewTypes: ['Narrative', 'Thematic', 'Scoping', 'Critical', 'ThesisChapter'], academicLevels: ['Undergraduate', 'Masters', 'Doctoral'], citationStyles: ['apa7', 'harvard'], minTargetWords: 1000, maxTargetWords: 15000 });
  if (p === base && m === 'GET') return ok([]);
  if (p === base && m === 'POST') return ok(review);
  if (p === `${base}/${id}` && m === 'GET') return ok(review);
  if (p === `${base}/${id}` && m === 'PATCH') { const body = req.postDataJSON(); Object.assign(review, { currentStep: Math.max(review.currentStep, body.currentStep ?? 0), revision: review.revision + 1 }); return ok(review); }
  if (p === `${base}/${id}/sources`) return ok(pool);
  if (p === `${base}/screening-reasons`) return ok([{ code: 'POPULATION', label: 'Wrong population' }, { code: 'NEEDS_FULLTEXT', label: 'Include, but I need the full text' }]);
  if (p === `${base}/${id}/screening` && m === 'GET') return ok({ items: screeningItems, totalCount: 2, page: 1, pageSize: 25, stateCounts: counts, screeningStatus: 'Completed', screeningProgressPct: 100, canApprove: true });
  if (p.startsWith(`${base}/${id}/screening/`) && m === 'PATCH') { decided = req.postDataJSON(); return ok({ ...screeningItems[0], state: 'Excluded', reasonCode: 'POPULATION', reasonLabel: 'Wrong population' }); }
  if (p === `${base}/${id}/screening/approve`) return ok({ addedToPool: 1, excludedForDateRange: 0, poolSize: 2, status: 'Extracting' });
  if (p === `${base}/${id}/coverage`) return ok({ discoveryStatus: 'Completed', found: 2, unique: 2, duplicates: 0, providers: [{ id: 'openalex', name: 'OpenAlex', state: 'Results', count: 2, message: '2 found' }, { id: 'pubmed', name: 'PubMed', state: 'ProviderUnavailable', count: 0, message: 'PubMed did not respond.' }], screeningStatus: 'Completed', stateCounts: counts, excludedByReason: {}, poolSize: 2, poolFullText: 0, poolAbstractOnly: 2, poolMetadataOnly: 0, coverageStatus: 'Moderate', dimensionsCoveredPct: 80, uncoveredDimensions: [], yearFrom: 2010, yearTo: null });
  if (p === `${base}/${id}/extraction`) return ok({ matrixId: null, matrixAvailable: true, poolSize: 2, inMatrix: 2, extracted: 2, notLinked: 0, consentAccepted: true, creditsPerStudy: 3, run: null });
  if (p === `${base}/${id}/runs/latest`) return ok(null);
  if (p === `${base}/${id}/themes`) return ok([theme]);
  if (p === `${base}/${id}/gaps`) return ok([]);
  if (p === `${base}/${id}/outline`) return ok(outline);
  if (p === `${base}/${id}/sections`) return ok(sections);
  if (p === `${base}/${id}/issues`) return ok(issues);
  if (p.includes('/research/projects/proj-1/literature-discovery/status')) return ok({ status: 'Completed', stageIndex: 5, statusMessage: '', liveActivityMessage: '', progressPct: 100, resultCount: 2, duplicateCount: 0, uniqueCount: 2, likelyRelevantCount: 2, coveragePct: 100, sourceCounts: { openalex: 2 }, stopReason: null, failedSources: [{ source: 'pubmed', displayName: 'PubMed', message: 'timeout' }], completedAt: now });
  return ok([]);
});
await page.addInitScript(() => { localStorage.setItem('humaniser-onboarding-seen', 'true') });

// List, then create.
await page.goto(`${origin}/app/literature-review`);
const skip = page.getByRole('button', { name: 'Skip', exact: true });
if (await skip.waitFor({ timeout: 5000 }).then(() => true, () => false)) await skip.click();
await page.getByRole('button', { name: 'New literature review' }).click();
await page.getByLabel('Research question or topic').fill(review.question);
await page.getByRole('button', { name: 'Create review' }).click();
await page.getByRole('heading', { name: review.title }).waitFor();

// 1 Scope → 2 Sources.
await page.getByRole('heading', { name: 'What is the review about?' }).waitFor();
await page.getByRole('button', { name: 'Save and continue to sources' }).click();
await page.getByRole('tab', { name: 'Research Library' }).waitFor();
await page.getByRole('tab', { name: 'Search databases' }).click();
await page.getByText('did not respond, so their results are missing, not empty').waitFor();
await page.getByText(/at least 8 sources/).waitFor();
await page.getByRole('button', { name: 'Continue to screening' }).click();

// 3 Screen and extract.
await page.getByRole('heading', { name: 'Screen what the search found' }).waitFor();
await page.getByRole('button', { name: 'Exclude…' }).first().click();
await page.getByLabel('Reason').selectOption('POPULATION');
await page.getByRole('button', { name: 'Exclude', exact: true }).click();
await page.getByText('Wrong population.').waitFor();
if (decided?.decision !== 'exclude' || decided?.reasonCode !== 'POPULATION') throw Error('The exclusion was not sent with its reason');
await page.getByRole('button', { name: 'Add the included papers to the review' }).click();
await page.getByText(/added to the review/).waitFor();
await page.getByRole('button', { name: 'Continue to themes' }).click();

// 4 Themes: the failed point is shown, not hidden.
await page.getByRole('heading', { name: 'Heavier use and anxiety' }).waitFor();
await page.getByText('Not used in the draft: The number 50% is not in any of its quotes.').waitFor();
await page.getByRole('button', { name: 'Continue to drafting' }).click();

// 5 Draft: citations rendered, the unknown one flagged.
await page.getByRole('heading', { name: 'Draft', exact: true }).waitFor();
await page.getByText('not in the review: S9').first().waitFor();
await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
const editor = page.getByLabel('Text of Introduction');
if (!(await editor.inputValue()).includes('[@1][@2]')) throw Error('Citations were not shown as numbered markers while editing');
await page.getByRole('button', { name: 'Cancel' }).click();
await page.getByRole('button', { name: 'Continue to review' }).click();

// 6 Review: export is closed while something blocking is open.
await page.getByRole('heading', { name: 'Check and export' }).waitFor();
await page.getByText('Not ready to export: 1 blocking issue.').waitFor();
for (const name of ['Open in editor', 'Word', 'PDF']) if (!(await page.getByRole('button', { name, exact: true }).isDisabled())) throw Error(`${name} was enabled with a blocking issue open`);
await page.screenshot({ path: join(tmpdir(), 'humaniser-literature-review-desktop.png'), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: join(tmpdir(), 'humaniser-literature-review-mobile.png'), fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) {
  const culprits = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(e => {
      if (e.getBoundingClientRect().right <= window.innerWidth + 1 || getComputedStyle(e).position === 'fixed') return false
      // Content inside its own horizontal scroller (the step rail) does not widen the page.
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(a).overflowX)) return false
      return true
    })
    .slice(0, 8).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 80)} right=${Math.round(e.getBoundingClientRect().right)}`));
  const chain = await page.evaluate(() => {
    const out = []
    for (let e = document.querySelector('nav[aria-label="Literature review steps"] ol'); e; e = e.parentElement)
      out.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)} client=${e.clientWidth} scroll=${e.scrollWidth} ox=${getComputedStyle(e).overflowX}`)
    return out
  });
  const outside = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(e => ['absolute'].includes(getComputedStyle(e).position) && e.getBoundingClientRect().right > window.innerWidth + 1)
    .slice(0, 8).map(e => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 80)} text="${(e.textContent ?? '').slice(0, 40)}" right=${Math.round(e.getBoundingClientRect().right)}`));
  throw Error('The page scrolls sideways at phone width:\n' + culprits.join('\n') + '\nRail ancestry:\n' + chain.join('\n') + '\nAbsolute:\n' + outside.join('\n'));
}
if (errors.length) throw Error(errors.join('\n'));
console.log('Literature Review Studio smoke passed: create, scope, sources (provider down shown), screening with reason, approve, themes (failed point shown), draft (unknown citation flagged, numbered editing), export blocked; desktop and 390px.');
await browser.close();
