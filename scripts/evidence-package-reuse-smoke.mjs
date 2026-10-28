// Mocked browser verification; no paid provider/LLM calls.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const fixture = readFileSync(new URL('./proposal-workflow-smoke.mjs', import.meta.url), 'utf8')
const spec = JSON.parse(JSON.stringify(Function(`return (${fixture.match(/const spec=(.*?);\r?\nconst state=/s)[1]})`)()))
const state = { accepted: { id: 'revision', version: 1, specification: spec }, importedDraft: spec, contracts: [], findings: [], evidence: [], gaps: [], reviews: [] }
const source = { id: 'source', title: 'Verified learning study', authors: ['Smith'], year: 2024, polarity: 'Supports', verification: 'Verified' }
const evidence = { sessionId: 'session', projectId: 'mock', contentHash: 'original-hash', researchQuestion: 'Learning outcomes', scope: null, evidenceSufficient: false, completionReason: 'BudgetSources', acceptedEvidence: [source] }
let attached = false, submitted = null
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body = { data: [] }
    if (path.endsWith('/auth/refresh')) body = { accessToken: 'mock', user: { id: 'user', name: 'Researcher', email: 'test@example.test', plan: 'Pro', isEmailVerified: true } }
    else if (path.endsWith('/proposal-workflow')) body = { data: state }
    else if (path.endsWith('/proposal-workflow/history')) body = { data: { revisions: [], artifacts: [], sections: [] } }
    else if (path.endsWith('/deep-research')) body = { data: [{ id: 'session', researchQuestion: 'Learning outcomes', isFinished: true, status: 'Stopped' }] }
    else if (path.endsWith('/evidence-package')) body = { data: evidence }
    else if (path.endsWith('/review-feedback')) body = { data: null }
    else if (path.endsWith('/packages')) body = { data: attached ? [{ id: 'handoff', sessionId: 'session', isCurrent: true, package: evidence, sources: [{ sourceId: 'source', literatureId: 'literature' }], limitations: [] }] : [] }
    else if (path.endsWith('/reuse')) {
      if (route.request().method() === 'POST') { submitted = route.request().postDataJSON(); attached = true } else attached = false
      body = { data: {} }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.addInitScript(() => localStorage.setItem('humaniser-onboarding-seen', 'true'))
  await page.goto(`${process.env.PACKAGE_SMOKE_ORIGIN || 'http://localhost:3000'}/app/research-agent/mock/proposal-workflow?package=session`)
  await page.getByRole('heading', { name: 'Reuse Deep Research evidence' }).waitFor()
  const skip = page.getByRole('button', { name: 'Skip', exact: true }); if (await skip.isVisible()) await skip.click()
  await page.getByLabel('Verified learning study · Supports').check()
  const reuse = page.getByRole('button', { name: 'Reuse selected evidence' })
  if (!await reuse.isDisabled()) throw Error('Partial evidence did not require acknowledgment')
  await page.getByLabel(/I understand this package is partial/).check()
  await reuse.click()
  await page.getByText('Attached to current research revision', { exact: false }).waitFor()
  if (submitted.expectedSpecificationId !== 'revision' || submitted.expectedPackageHash !== 'original-hash' || submitted.sourceIds.join() !== 'source' || !submitted.acknowledgePartialEvidence) throw Error('Missing revision, package, selection or acknowledgment in request')
  await page.getByRole('button', { name: 'Propose binding: Verified learning study' }).waitFor()
  await page.getByRole('button', { name: 'Review proposal with evidence' }).waitFor()
  await page.getByRole('button', { name: 'Stop using package' }).click()
  await page.getByRole('button', { name: 'Stop using package' }).waitFor({ state: 'hidden' })
  if (errors.length) throw Error(errors.join('\n'))
  console.log('Passed: explicit source selection, partial acknowledgment, provenance, reuse, binding proposal, reviewer handoff, detach.')
} finally { await browser.close() }
