// Mocked API browser verification: no provider calls or development database changes.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const origin = process.env.PHASE8_SMOKE_ORIGIN || 'http://127.0.0.1:3018'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' })
let assertions = 0
const check = (value, message) => { assertions++; if (!value) throw Error(message) }
const errors = []; const network = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('/api/')) network.push(r.url()) })
const spec = { title: 'LMS adoption', problem: 'A scoped learning problem', field: 'Education', academicLevel: 'MASTERS', geography: 'Cape Town', population: 'Undergraduate students', unitOfAnalysis: 'Student', temporalScope: '2027', framework: 'Technology adoption', contribution: 'A scoped association', limitations: 'One campus', scopeLimits: 'One enrolled population', citationStyle: 'harvard', institutionRequirements: 'Reviewed', universityTemplateId: null, methodologyVersion: 2, mixedMethodIntegration: '', totalWords: 6000, hypothesisApplicability: 'NotApplicable', hypothesisRationale: 'Descriptive association', hypotheses: [], questions: [{ id: 'q', text: 'How is usability associated with adoption?' }], objectives: [{ id: 'o', text: 'Estimate the association', type: 'Specific', questionIds: ['q'], constructIds: [], dataSourceIds: ['d'], analysisIds: ['a'] }], constructs: [], dataSources: [{ id: 'd', name: 'Survey', collectionMethod: 'Questionnaire', literatureId: null }], analyses: [{ id: 'a', method: 'Correlation', assumptions: ['Independent students'], missingDataHandling: 'Report missingness', strand: 'Quantitative' }], sampling: { design: 'Correlation', confidence: .95, margin: null, proportion: null, populationSize: null, effectSize: .3, power: .8, designEffect: 1, responseRate: .9, frame: 'Enrollment registry', rationale: 'Primary association' }, study: { design: { $family: 'Quantitative' } } }
const state = { accepted: { id: 'revision-b', version: 2, hash: 'hash', specification: spec }, importedDraft: spec, policyVersion: 'proposal-policy.v2', enforcementMode: 'Enforced', fingerprint: 'review', contracts: [{ code: '5.7a', title: 'Data Analysis Plan', order: 1, targetWords: 400, minWords: 300, maxWords: 500, required: true, dependencies: ['4.1'], requiresEvidence: true }], findings: [{ key: 'pending', status: 'Pending', severity: 'Blocker', message: 'Review affected sections.', sectionCode: '5.7a' }], evidence: [], gaps: [], reviews: [] }
let readiness = { mode: 'CanonicalResearchDesign', canGenerate: false, acceptedRevisionId: 'revision-b', acceptedVersion: 2, boundRevisionId: 'revision-a', validationFingerprint: 'private-fingerprint', findings: [{ key: 'RECONCILE', status: 'Stale', severity: 'Blocker', message: 'Your proposal uses an earlier design. Review the affected sections.', sectionCode: null }], sections: [{ code: '5.7a', affected: true, generatedRevisionId: 'revision-a', contentVersion: 'section-v1', reason: 'Analysis changed' }], allowedActions: ['ViewResearchDesign', 'UseUpdatedDesign', 'ReviewAffectedSections'] }
let content = 'A student paragraph. The study will use thematic coding. My ending.', version = 'section-v1', requests = [], bindingFailure = false, readinessFailure = false, reconciliationFailure = true
const replies = { '/history': () => ({ revisions: [], artifacts: [], sections: [{ sectionCode: '5.7a', contentVersion: version, status: 'Edited', content }] }), '/sources': () => [], '/readiness': () => readiness }
try {
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data = []
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'mock', user: { id: 'student', email: 'test@example.test', name: 'Student', plan: 'Pro', isEmailVerified: true } }
    else if (path.endsWith('/review-feedback')) data = null
    else if (path.includes('/proposal-workflow')) {
      if (request.method() === 'POST') {
        requests.push({ path, payload: request.postDataJSON() })
        if (path.endsWith('/design-binding')) {
          if (bindingFailure) { bindingFailure = false; await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'PROPOSAL_REVISION_CONFLICT', message: 'Changed' }) }); return }
          readiness = { ...readiness, boundRevisionId: 'revision-b', canGenerate: true, findings: [], allowedActions: ['ViewResearchDesign', 'Generate', 'ReviewAffectedSections'] }; data = readiness
        } else if (path.endsWith('/repair-preview')) data = { sectionCode: '5.7a', specificationId: 'revision-b', contentVersion: version, originalContent: content, suggestedContent: content.replace('The study will use thematic coding.', 'The study will use correlation.'), findings: [{ key: 'PD-METHOD-001', expected: 'Use the accepted correlation analysis.' }], requiresManualResolution: false }
        else if (path.endsWith('/sections/reconcile')) { if (reconciliationFailure) { reconciliationFailure = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Save response unavailable' }) }); return }; data = {}; content = request.postDataJSON().content; version = 'section-v2' }
        else data = { sectionCode: '5.7a', content, contentVersion: version }
      } else {
        if (path.endsWith('/readiness') && readinessFailure) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) }); return }
        data = path.endsWith('/proposal-workflow') ? state : Object.entries(replies).find(([suffix]) => path.endsWith(suffix))?.[1]() ?? []
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.addInitScript(() => localStorage.setItem('humaniser-onboarding-seen', 'true'))
  const open = async () => { await page.goto(`${origin}/app/research-agent/project/proposal-workflow`); await page.getByRole('heading', { name: 'Proposal Research & Review', exact: true }).waitFor(); const skip = page.getByRole('button', { name: 'Skip', exact: true }); if (await skip.isVisible()) await skip.click() }
  await open()
  check(await page.getByRole('link', { name: 'Documents', exact: true }).isVisible(), 'Existing navigation missing')
  check(await page.getByRole('heading', { name: 'Research design · version 2' }).isVisible(), 'Accepted version not visible')
  check(await page.getByRole('link', { name: 'View or update research design' }).isVisible(), 'Missing canonical design entry')
  check(await page.getByRole('button', { name: 'Add hypothesis', exact: true }).count() === 0, 'Duplicate methodology editor is active')
  check(!(await page.locator('body').innerText()).includes('private-fingerprint'), 'Internal fingerprint exposed')
  await page.getByRole('button', { name: 'Writing & Acceptance', exact: true }).click()
  check(await page.getByRole('button', { name: 'Generate', exact: true }).isDisabled(), 'Writing bypassed readiness gate')
  await page.getByRole('button', { name: 'Use updated design', exact: true }).click()
  check(await page.getByRole('dialog').isVisible(), 'Revision adoption lacks confirmation')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  check(requests.length === 0, 'Cancelled adoption sent a command')
  await page.getByRole('button', { name: 'Use updated design', exact: true }).click()
  bindingFailure = true
  await page.getByRole('dialog').getByRole('button', { name: 'Use updated design', exact: true }).click()
  await page.getByText('This research design changed since you opened it.', { exact: false }).waitFor()
  check(await page.getByRole('button', { name: 'Generate', exact: true }).isDisabled(), 'Conflict enabled generation')
  const key = requests[0].payload.idempotencyKey
  await page.getByRole('dialog').getByRole('button', { name: 'Use updated design', exact: true }).click()
  await page.getByRole('button', { name: 'Generate', exact: true }).waitFor()
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(e => e.textContent === 'Generate')?.disabled)
  check(requests[1].payload.idempotencyKey === key, 'Retry lost adoption idempotency key')
  check(requests[1].payload.expectedRevisionId === 'revision-b' && requests[1].payload.expectedBoundRevisionId === 'revision-a', 'Revision adoption lacks concurrency inputs')
  check(content.includes('thematic coding'), 'Adoption overwrote student text')
  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  await page.getByRole('dialog').getByText('Replace this draft?').waitFor()
  await page.getByRole('button', { name: 'Keep my draft', exact: true }).click()
  check(!requests.some(r => r.path.endsWith('/generate')), 'Cancelled regeneration sent a write')
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await page.getByRole('button', { name: 'Preview targeted repair', exact: true }).click()
  await page.getByRole('dialog').getByText('Review a targeted repair').waitFor()
  check(content.includes('thematic coding'), 'Preview changed saved content')
  check(!requests.some(r => r.path.endsWith('/sections/reconcile')), 'Preview issued an automatic save')
  await page.getByRole('button', { name: 'Use suggestion in editor', exact: true }).click()
  check((await page.getByLabel(/Revised section/).inputValue()).includes('A student paragraph.'), 'Student wording lost')
  check((await page.getByLabel(/Revised section/).inputValue()).includes('correlation'), 'Suggestion not loaded into editor')
  const reconciled = page.waitForResponse(r => r.url().endsWith('/sections/reconcile'))
  await page.getByRole('button', { name: 'Save Reconciled Draft', exact: true }).click(); await reconciled
  await page.getByText('Save response unavailable', { exact: true }).waitFor(); check(content.includes('thematic coding'), 'Failed save changed content'); const retrySave = page.waitForResponse(r => r.url().endsWith('/sections/reconcile')); await page.getByRole('button', { name: 'Save Reconciled Draft', exact: true }).click(); await retrySave; const saves = requests.filter(r => r.path.endsWith('/sections/reconcile')); check(saves.length === 2 && saves[0].payload.idempotencyKey === saves[1].payload.idempotencyKey, 'Ambiguous save retry changed its key'); const saved = saves[1].payload
  check(saved.expectedContentVersion === 'section-v1' && saved.expectedSpecificationRevision === 'revision-b', 'Reconciliation not pinned to reviewed versions')
  check(!!saved.idempotencyKey, 'Reconciliation lacks retry key')
  check(saved.content.includes('A student paragraph.') && saved.content.includes('My ending.'), 'Targeted repair replaced unrelated student text')
  await page.getByRole('button', { name: 'Submission Review', exact: true }).click()
  check(await page.getByRole('button', { name: /Finalize/ }).isDisabled(), 'Pending final checks were bypassed')
  mkdirSync('docs/research-design-phase8', { recursive: true }); await page.screenshot({ path: 'docs/research-design-phase8/readiness-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'docs/research-design-phase8/readiness-mobile.png', fullPage: true })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page overflows horizontally')
  readinessFailure = true; await open(); await page.getByText('Unable to check your research design.', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Writing & Acceptance', exact: true }).click()
  check(await page.getByRole('button', { name: 'Generate', exact: true }).isDisabled(), 'Failed readiness enabled writing')
  check(errors.length === 0, `Browser errors: ${errors.join('; ')}`)
  writeFileSync('docs/research-design-phase8/browser-results.json', JSON.stringify({ assertions, errors, commands: requests.map(r => r.path), liveProviders: 0 }, null, 2))
  console.log(`Phase 8 browser checks passed: ${assertions} assertions.`)
} catch (e) {
  mkdirSync('docs/research-design-phase8', { recursive: true })
  writeFileSync('docs/research-design-phase8/browser-debug.json', JSON.stringify({ error: e.message, errors, network, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 8000) }, null, 2))
  throw e
} finally { await browser.close() }
