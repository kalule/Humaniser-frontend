import { chromium } from 'playwright'

const OUT = 'C:/Users/42153/AppData/Local/Temp/claude/c--Users-42153-OneDrive-Desktop-IT-Projects-Humaniser-frontend/7680fe83-c4c1-4987-b555-32bd6b79f404/scratchpad'

const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
await page.setViewportSize({ width: 1400, height: 1000 })

page.on('console', msg => {
  if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text())
})
page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:3000/app/plagiarism', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const trySample = page.getByText('Try sample')
if (await trySample.count() > 0) {
  await trySample.click()
}
await page.waitForTimeout(300)

await page.screenshot({ path: `${OUT}/1_before_check.png`, fullPage: false })

const checkBtn = page.getByRole('button', { name: /Check sources/i })
await checkBtn.click()

await page.waitForSelector('text=/sources searched/i', { timeout: 45000 }).catch((e) => console.log('WAIT FAILED', e.message))
await page.waitForTimeout(500)

await page.screenshot({ path: `${OUT}/2_after_check.png`, fullPage: false })

const checkBtnAfter = page.getByRole('button', { name: /Check sources|Checked/i })
const btnText = await checkBtnAfter.textContent().catch(() => null)
const btnDisabled = await checkBtnAfter.isDisabled().catch(() => null)
console.log('BUTTON TEXT:', btnText?.trim())
console.log('BUTTON DISABLED:', btnDisabled)

const bodyText = await page.locator('body').innerText()
const verdictMatches = (bodyText.match(/Likely Original|Low Similarity|Suspicious|High Similarity/g) || [])
console.log('VERDICT OCCURRENCES:', verdictMatches)

await browser.close()
