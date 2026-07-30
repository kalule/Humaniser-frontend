import { chromium } from 'playwright'

const OUT = 'C:/Users/42153/AppData/Local/Temp/claude/c--Users-42153-OneDrive-Desktop-IT-Projects-Humaniser-frontend/1299f7d0-1578-49bf-9ffc-0de50c2a5a19/scratchpad'
const PROJECT_ID = '19370fe6-d732-49bd-9e79-b8eb1b3e80be'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

page.on('console', msg => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text())
})
page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"], input[name="email"]', 'admin@humaniseai.com')
await page.fill('input[type="password"], input[name="password"]', 'Admin@123456')
await Promise.all([
  page.waitForResponse(r => r.url().includes('/auth/login'), { timeout: 20000 }),
  page.click('button[type="submit"]'),
])
await page.waitForTimeout(1500)

const skip = page.getByText('Skip', { exact: true })
if (await skip.count()) { await skip.click(); await page.waitForTimeout(300) }

await page.goto(`http://localhost:3000/app/literature-review?projectId=${PROJECT_ID}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

console.log('URL:', page.url())
await page.screenshot({ path: `${OUT}/write-1-initial.png`, fullPage: false })

// Wait for the outline / editor to actually render
await page.waitForSelector('text=/Chapter 1/i', { timeout: 15000 }).catch(e => console.log('OUTLINE WAIT FAILED', e.message))
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/write-2-outline-loaded.png`, fullPage: false })

// Click Evidence tab data, then Quality tab, then Notes tab
const evidenceTab = page.getByRole('button', { name: /Evidence/i })
if (await evidenceTab.count()) { await evidenceTab.first().click(); await page.waitForTimeout(500) }
await page.screenshot({ path: `${OUT}/write-3-evidence-tab.png`, fullPage: false })

const qualityTab = page.getByRole('button', { name: /Quality/i })
if (await qualityTab.count()) { await qualityTab.first().click(); await page.waitForTimeout(500) }
await page.screenshot({ path: `${OUT}/write-4-quality-tab.png`, fullPage: false })

const notesTab = page.getByRole('button', { name: /Notes/i })
if (await notesTab.count()) { await notesTab.first().click(); await page.waitForTimeout(500) }
await page.screenshot({ path: `${OUT}/write-5-notes-tab.png`, fullPage: false })

// Click a different section in the outline
const chapter2 = page.getByText(/2\.0 Literature Review/i)
if (await chapter2.count()) {
  await chapter2.first().click()
  await page.waitForTimeout(1000)
}
await page.screenshot({ path: `${OUT}/write-6-section-switch.png`, fullPage: false })

const bodyText = await page.locator('body').innerText()
console.log('HAS "Approved evidence":', bodyText.includes('Approved evidence'))
console.log('HAS "218":', bodyText.includes('218'))
console.log('HAS "Chapter 1":', bodyText.includes('Chapter 1'))

await browser.close()
console.log('DONE')
