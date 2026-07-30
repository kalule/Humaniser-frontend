import { chromium } from 'playwright';

const base = 'http://localhost:3008';
const outDir = 'C:\\Users\\42153\\AppData\\Local\\Temp\\claude\\c--Users-42153-OneDrive-Desktop-IT-Projects-Humaniser-frontend\\5f143ae8-3268-46c0-bf9e-91eb6908a1ac\\scratchpad';

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: './_color_audit_authstate.json', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

async function closeOnboarding() {
  const skip = page.locator('text=Skip').first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  const closeX = page.locator('button:has(svg.lucide-x)').first();
  if (await closeX.isVisible().catch(() => false)) {
    await closeX.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

// Grammar page — category chips + Accept All
await page.goto(base + '/app/grammar', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
console.log('grammar url', page.url());
await closeOnboarding();
// enable a couple of category chips + type text to trigger a check with a suggestion
await page.fill('textarea', 'She recieved the report on monday and it were good.').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}\\grammar.png` });

// Summarise page — mode tabs + length control
await page.goto(base + '/app/summarise', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
console.log('summarise url', page.url());
await closeOnboarding();
await page.screenshot({ path: `${outDir}\\summarise.png` });

// Paraphrase page — mode tabs + intensity
await page.goto(base + '/app/paraphrase', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
console.log('paraphrase url', page.url());
await closeOnboarding();
await page.screenshot({ path: `${outDir}\\paraphrase.png` });

await browser.close();
console.log('done');
