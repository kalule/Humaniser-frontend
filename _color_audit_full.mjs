import { chromium } from 'playwright';

const base = 'http://localhost:3008';
const outDir = 'C:\\Users\\42153\\AppData\\Local\\Temp\\claude\\c--Users-42153-OneDrive-Desktop-IT-Projects-Humaniser-frontend\\5f143ae8-3268-46c0-bf9e-91eb6908a1ac\\scratchpad';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

await page.goto(base + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"], input[name="email"]', 'admin@humaniseai.com');
await page.fill('input[type="password"], input[name="password"]', 'Admin@123456');
await Promise.all([
  page.waitForResponse(r => r.url().includes('/auth/login'), { timeout: 20000 }).catch(() => null),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(2000);
console.log('post-login url', page.url());

async function closeOnboarding() {
  for (const sel of ['text=Skip', 'button:has(svg.lucide-x)']) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

// Grammar page
await page.goto(base + '/app/grammar', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
console.log('grammar url', page.url());
await closeOnboarding();
await page.fill('textarea', 'She recieved the report on monday and it were good.').catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}\\grammar.png` });

// Summarise page
await page.goto(base + '/app/summarise', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
console.log('summarise url', page.url());
await closeOnboarding();
await page.screenshot({ path: `${outDir}\\summarise.png` });

// Paraphrase page
await page.goto(base + '/app/paraphrase', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(1000);
console.log('paraphrase url', page.url());
await closeOnboarding();
await page.screenshot({ path: `${outDir}\\paraphrase.png` });

await browser.close();
console.log('done');
