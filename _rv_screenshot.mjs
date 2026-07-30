import { chromium } from 'playwright'

const dir = 'C:/Users/42153/AppData/Local/Temp/claude/c--Users-42153-OneDrive-Desktop-IT-Projects-Humaniser-frontend/56053a83-7fa7-4f62-ae42-e56593755987/scratchpad'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

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

// client-side nav — don't full-reload, the access token lives in memory only
const navLink = page.getByRole('link', { name: /Summarise/i }).or(page.getByText('Summarise', { exact: true }))
await navLink.first().click()
await page.waitForURL('**/app/summarise', { timeout: 10000 })
await page.waitForTimeout(800)

await page.screenshot({ path: `${dir}/1-empty.png` })
console.log('URL:', page.url())

const trySample = page.getByText('Try sample', { exact: true })
if (await trySample.count()) {
  await trySample.click()
  await page.waitForTimeout(300)
}
await page.screenshot({ path: `${dir}/2-filled.png` })

const summariseBtn = page.getByRole('button', { name: /^Summarise$/ }).last()
await summariseBtn.click()
await page.waitForTimeout(8000)
await page.screenshot({ path: `${dir}/3-result.png` })

await page.getByRole('button', { name: 'Meeting Notes' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${dir}/4-meetingnotes-tab.png` })

await browser.close()
console.log('DONE')
