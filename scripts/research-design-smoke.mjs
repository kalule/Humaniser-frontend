// Entire API is intercepted. No live models, literature providers or database writes.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const fixture = JSON.parse(readFileSync(new URL('../src/components/research-design/fixtures/lms-design.json', import.meta.url), 'utf8'))
const origin = process.env.DESIGN_SMOKE_ORIGIN || 'http://127.0.0.1:3017'
const browser = await chromium.launch({ headless: true })
let assertions = 0
const check = (condition, message) => { assertions++; if (!condition) throw Error(message) }
const clone = () => structuredClone(fixture)
let view = clone(), requests = [], failure = null, delay = 0, historyFailure = false
const errors = []
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
page.on('pageerror', error => errors.push(error.message))
const setState = (status, actions) => { view.status = status; view.currentStage = status; view.progress.stage = status; view.allowedActions = actions; view.version = crypto.randomUUID(); view.runId ??= '33333333-3333-4333-8333-333333333333' }
try {
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let data = []
    if (path.endsWith('/auth/refresh')) data = { accessToken: 'mock', user: { id: 'student', name: 'Student', email: 'test@example.test', plan: 'Pro', isEmailVerified: true } }
    else if (path.includes('/design')) {
      if (request.method() === 'POST') {
        requests.push({ path, payload: request.postDataJSON() })
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
        if (failure) { const status = failure; failure = null; await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: status === 409 ? 'RESEARCH_DESIGN_STALE_REVISION' : 'RESEARCH_DESIGN_VALIDATION_BLOCKED', message: 'internal test detail', correlationId: 'support-reference' } }) }); return }
        if (path.endsWith('/input')) { setState('RequiresEvidence', ['Cancel']); view.questions = []; view.evidence[0].status = 'Unresolved'; view.evidence[0].researchStatus = 'Investigating' }
        else if (path.endsWith('/accept')) { setState('Accepted', ['View', 'Revise']); view.canonicalRevision = '44444444-4444-4444-8444-444444444444' }
        else if (path.endsWith('/cancel')) setState('Cancelled', ['View', 'Restart'])
        else setState('Created', ['Cancel'])
        data = { view, idempotencyHit: false, backgroundWork: true }
      } else if (path.endsWith('/history')) {
        if (historyFailure) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL' } }) }); return }
        data = { items: [{ runId: 'history-run', status: 'Superseded', createdAt: '2026-10-05T10:00:00Z', completedAt: null, canonicalRevision: null, title: 'Research Design' }], nextCursor: null }
      } else data = path.endsWith('/history-run') ? { ...view, status: 'Superseded', allowedActions: ['View'] } : view
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.addInitScript(() => localStorage.setItem('humaniser-onboarding-seen', 'true'))
  const open = async () => { await page.goto(`${origin}/app/research-design/${fixture.projectId}`); await page.locator('#main-content').getByRole('heading', { name: 'Research Design', exact: true }).waitFor(); const skip = page.getByRole('button', { name: 'Skip', exact: true }); if (await skip.isVisible()) await skip.click() }
  const screenshot = async name => { await page.waitForTimeout(350); mkdirSync('docs/research-design-phase7', { recursive: true }); await page.screenshot({ path: `docs/research-design-phase7/${name}.png`, fullPage: true }) }
  await open()
  check(await page.getByRole('button', { name: 'Build my research design' }).isVisible(), 'Missing initial build')
  check(await page.getByRole('link', { name: 'Documents', exact: true }).isVisible(), 'Existing sidebar missing')
  await screenshot('not-started-desktop')
  await page.getByRole('button', { name: 'Build my research design' }).dblclick()
  await page.getByText('Your research design is queued', { exact: true }).first().waitFor()
  check(requests.length === 1, 'Duplicate run submitted')
  check(!('specification' in requests[0].payload), 'Client submitted design truth')
  await page.reload(); await page.getByText('Your research design is queued', { exact: true }).first().waitFor()
  check(requests.length === 1, 'Reload created a run')
  check(await page.getByText('You can leave this page.', { exact: false }).isVisible(), 'Durability unexplained')
  setState('RequiresInput', ['ProvideInput', 'Cancel']); view.questions = [{ id: '55555555-5555-4555-8555-555555555555', question: 'Who will take part in your study?', reason: 'Your population affects sampling and analysis.', field: 'TargetPopulation', valueType: 'Text', answerable: true, maxLength: 500 }]
  await page.reload(); await page.getByLabel('Your answer').waitFor()
  check(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), 'Empty answer accepted')
  await page.getByLabel('Your answer').fill('Undergraduate students')
  await page.getByLabel('Your answer').press('Enter')
  await page.getByRole('heading', { name: 'Checking the evidence', exact: true }).waitFor()
  check(requests.at(-1).payload.value.text === 'Undergraduate students', 'Typed answer missing')
  check(requests.at(-1).payload.questionId === '55555555-5555-4555-8555-555555555555', 'Question ID missing')
  view.evidence[0].status = 'Supported'; view.evidence[0].researchStatus = 'Complete'; view.readiness.status = 'ReadyForReview'; view.readiness.canAccept = true; setState('ReadyForReview', ['Accept', 'Revise', 'Cancel'])
  await page.getByRole('button', { name: 'Accept research design', exact: true }).waitFor({ timeout: 20000 })
  check(view.status === 'ReadyForReview', 'Evidence completion did not refresh through polling')
  for (const section of ['Review full design', 'Research alignment', 'Evidence supporting the design', 'Compare alternatives']) await page.getByText(section, { exact: true }).click()
  check(await page.getByText('Association estimate with uncertainty', { exact: false }).isVisible(), 'Alignment invisible')
  check(await page.getByText('Transferability to the study setting needs review', { exact: true }).isVisible(), 'Evidence limitation hidden')
  await screenshot('ready-desktop')
  await page.getByRole('button', { name: 'Accept research design', exact: true }).click()
  check(await page.getByRole('dialog').isVisible(), 'Missing acceptance confirmation')
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' })
  check(await page.getByRole('button', { name: 'Accept research design', exact: true }).evaluate(el => el === document.activeElement), 'Dialog did not restore focus')
  await page.getByRole('button', { name: 'Accept research design', exact: true }).click()
  delay = 300
  await page.getByRole('button', { name: 'Accept design', exact: true }).dblclick()
  await page.getByRole('heading', { name: 'Research design accepted', exact: true }).waitFor()
  check(requests.filter(r => r.path.endsWith('/accept')).length === 1, 'Duplicate acceptance')
  check(Object.keys(requests.at(-1).payload).sort().join() === 'expectedSpecificationRevision,expectedVersion,idempotencyKey', 'Acceptance includes client methodology')
  await page.reload(); await page.getByRole('heading', { name: 'Research design accepted', exact: true }).waitFor()
  check(await page.getByRole('button', { name: 'Create revision', exact: true }).isVisible(), 'Accepted revision unavailable')
  check(!(await page.getByRole('button', { name: 'Accept research design', exact: true }).count()), 'Accepted state still exposes acceptance')
  await screenshot('accepted-desktop')
  setState('ReadyForReview', ['Revise']); await page.reload(); await page.getByRole('button', { name: 'Create revision', exact: true }).waitFor()
  check(!(await page.getByRole('button', { name: 'Accept research design', exact: true }).count()), 'UI inferred acceptance from readiness')
  setState('RequiresInput', ['Cancel']); await page.reload(); await page.getByRole('button', { name: 'Stop building' }).waitFor()
  check(!(await page.getByRole('button', { name: 'Continue', exact: true }).count()), 'Input action rendered without permission')
  setState('ReadyForReview', ['Accept', 'Revise', 'Cancel']); failure = 409; await page.reload()
  await page.getByRole('button', { name: 'Accept research design', exact: true }).click(); await page.getByRole('button', { name: 'Accept design', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'changed since you opened' }).waitFor()
  check(view.status === 'ReadyForReview', 'UI optimistically accepted conflict')
  check(await page.getByRole('button', { name: 'Accept research design', exact: true }).isDisabled(), 'Conflict allows blind retry')
  check(!(await page.getByText('internal test detail', { exact: false }).count()), 'Raw server message leaked')
  await page.getByRole('button', { name: 'Refresh latest version' }).click()
  await page.getByRole('alert').filter({ hasText: 'changed since you opened' }).waitFor({ state: 'hidden' })
  setState('RequiresEvidence', ['Cancel']); view.evidence[0].status = 'InsufficientEvidence'; view.evidence[0].researchStatus = 'Unresolved'; await page.reload(); await page.getByText('Evidence supporting the design', { exact: true }).click()
  check(await page.getByText('More evidence is needed', { exact: true }).isVisible(), 'Insufficient evidence overstated')
  view.evidence[0].status = 'ProviderUnavailable'; await page.reload(); await page.getByText('Evidence supporting the design', { exact: true }).click()
  check(await page.getByText('We couldn’t complete the evidence check right now', { exact: true }).isVisible(), 'Provider failure treated as absence')
  view.evidence[0].status = 'Supported'; view.evidence[0].contradictionPresent = true; await page.reload(); await page.getByText('Evidence supporting the design', { exact: true }).click()
  check(await page.getByText('Evidence is mixed', { exact: true }).isVisible(), 'Contradiction hidden')
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 }); setState('ReadyForReview', ['Accept', 'Revise']); await page.reload(); await page.getByRole('button', { name: 'Accept research design', exact: true }).waitFor()
    await page.getByText('Research alignment', { exact: true }).click(); await page.getByText('Evidence supporting the design', { exact: true }).click()
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`)
    await page.getByRole('button', { name: 'Accept research design', exact: true }).click(); check(await page.getByRole('dialog').evaluate(el => el.getBoundingClientRect().width <= innerWidth), `Dialog overflow ${width}`); await screenshot(`ready-${width}`); await page.keyboard.press('Escape')
  }
  setState('Failed', ['View', 'Restart']); await page.reload(); await page.getByRole('button', { name: 'Try again', exact: true }).waitFor()
  check(await page.getByText('Your work has been saved.', { exact: false }).isVisible(), 'Failure lost saved-work message')
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('button', { name: 'Stop building' }).waitFor()
  check(requests.at(-1).path.endsWith('/revisions'), 'Restart bypassed revision endpoint')
  await page.getByRole('button', { name: 'Stop building' }).click(); await page.getByRole('button', { name: 'Stop', exact: true }).click(); await page.getByRole('heading', { name: 'Research design stopped', exact: true }).waitFor()
  check(requests.at(-1).path.endsWith('/cancel'), 'Cancel not persisted')
  setState('RequiresInput', ['ProvideInput', 'Cancel']); view.questions = [{ id: 'access-question', question: 'Confirm research access', reason: 'Feasibility affects the proposed design', field: 'ResearchAccess', valueType: 'AccessConfirmation', answerable: true, maxLength: null }]; await page.reload()
  await page.getByLabel('Can you access the participants?').selectOption('no'); await page.getByLabel('Can you obtain the data?').selectOption('yes'); await page.getByLabel('Are the necessary permissions resolved?').selectOption('no')
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('heading', { name: 'Checking the evidence', exact: true }).waitFor()
  check(requests.at(-1).payload.value.populationAccess === false && requests.at(-1).payload.value.dataAvailable === true && requests.at(-1).payload.value.permissionsResolved === false, 'False access answers discarded')
  setState('ReadyForReview', ['Accept', 'Revise']); await page.reload(); failure = 422
  await page.getByRole('button', { name: 'Accept research design', exact: true }).click(); await page.getByRole('button', { name: 'Accept design', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Review the latest questions' }).waitFor()
  check(view.status === 'ReadyForReview', 'Validation failure locally accepted design')
  const failedKey = requests.at(-1).payload.idempotencyKey
  await page.getByRole('button', { name: 'Refresh latest version' }).click(); await page.getByRole('alert').filter({ hasText: 'Review the latest questions' }).waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Accept research design', exact: true }).click(); await page.getByRole('button', { name: 'Accept design', exact: true }).click(); await page.getByRole('heading', { name: 'Research design accepted', exact: true }).waitFor()
  check(requests.at(-1).payload.idempotencyKey === failedKey, 'Retry replaced exact command key')
  setState('ReadyForReview', ['Accept', 'Revise']); await page.reload(); await page.getByRole('button', { name: 'Accept research design', exact: true }).waitFor()
  historyFailure = true; await page.getByRole('button', { name: 'Version history', exact: true }).click(); await page.getByText('We couldn’t load the history.', { exact: false }).waitFor()
  check(await page.getByRole('button', { name: 'Accept research design', exact: true }).isEnabled(), 'Optional history failure disabled workspace')
  historyFailure = false; await page.getByRole('button', { name: 'Retry history' }).click(); await page.getByRole('button', { name: 'View this version' }).click(); await page.getByText('Read only', { exact: false }).waitFor()
  check(!(await page.getByRole('dialog').getByRole('button', { name: 'Accept research design' }).count()), 'Historical view allows mutation')
  check(errors.length === 0, errors.join('\n'))
  writeFileSync('docs/research-design-phase7/browser-results.json', JSON.stringify({ assertions, failed: 0, skipped: 0, requests: requests.map(r => ({ path: r.path, keys: Object.keys(r.payload) })), pageErrors: errors }, null, 2))
  console.log(`Passed ${assertions} browser assertions: durable golden journey, actions, conflicts, evidence, accessibility, history and responsive widths.`)
} finally { await browser.close() }
