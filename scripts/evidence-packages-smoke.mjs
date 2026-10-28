// Local browser check with mocked APIs: no research/provider calls.
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const item = { id: 'finished', projectId: 'project', researchQuestion: 'Digital learning in South Africa', isFinished: true, status: 'Stopped', updatedAt: '2026-10-05', message: 'Budget limit reached' }
  const evidence = { schemaVersion: 'verified-evidence.v1', sessionId: 'finished', projectId: 'project', contentHash: 'stable-hash', researchQuestion: item.researchQuestion, scope: null, evidenceQuestions: [], keyFindings: [], acceptedEvidence: [], potentialResearchGaps: [], insufficientEvidence: [], contradictions: [], limitations: ['Provider unavailable; no absence claim can be made.'], searchCoverage: [], providerCoverage: [], completionReason: 'BudgetSources', usage: { searches: 1, elapsedSeconds: 40, estimatedLlmCostUsd: 0.01, inputTokens: 5, outputTokens: 6, providerCalls: 1 }, evidenceSufficient: false }
  let failDetail = false
  const calls = []
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); calls.push({ path: url.pathname, method: route.request().method() })
    let body = { data: [] }
    if (url.pathname.endsWith('/auth/refresh')) body = { accessToken: 'mock', user: { id: 'user', email: 'test@example.test', name: 'Researcher', plan: 'Pro', isEmailVerified: true } }
    else if (url.pathname.endsWith('/evidence-package')) {
      if (failDetail) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Package unavailable' }) })
      body = { data: evidence }
    } else if (url.pathname.endsWith('/deep-research')) body = { data: [item, { ...item, id: 'running', researchQuestion: 'Still running', isFinished: false }] }
    else if (url.pathname.endsWith('/research/projects')) body = { data: [{ id: 'project', title: 'Education project' }] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.addInitScript(() => localStorage.setItem('humaniser-onboarding-seen', 'true'))
  await page.goto(`${process.env.PACKAGE_SMOKE_ORIGIN || 'http://localhost:3000'}/app/web-library/packages`)
  await page.getByRole('heading', { name: 'Evidence packages', exact: true }).waitFor()
  const skip = page.getByRole('button', { name: 'Skip', exact: true }); if (await skip.isVisible()) await skip.click()
  await page.getByRole('button', { name: /Digital learning in South Africa/ }).click()
  await page.getByText(/Partial evidence — sufficiency not established/).waitFor()
  if (await page.getByRole('button', { name: /Still running/ }).count()) throw Error('Unfinished research listed as a package')
  await page.getByLabel('Search evidence packages').fill('missing')
  await page.getByText('No packages match your search.').waitFor()
  await page.getByLabel('Search evidence packages').fill('')
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download package' }).click(); await download
  await page.getByLabel('Filter packages by project').selectOption('project')
  await page.getByRole('button', { name: /Digital learning in South Africa/ }).click()
  await page.getByRole('heading', { name: item.researchQuestion }).waitFor()
  failDetail = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: 'Retry', exact: true }).waitFor()
  if (await page.getByRole('button', { name: 'Download package' }).count()) throw Error('Stale package retained after failed fetch')
  failDetail = false; await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await page.getByRole('button', { name: 'Download package' }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw Error('Mobile page overflows horizontally')
  if (calls.some(call => call.method === 'POST' && call.path.includes('/deep-research'))) throw Error('Browsing started research')
  if (errors.length) throw Error(errors.join('\n'))
  console.log('Passed: list, partial status, search, project filter, download, failed fetch/retry, no research rerun, mobile width.')
} finally { await browser.close() }
