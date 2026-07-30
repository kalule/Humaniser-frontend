const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  page.on('response', res => { if (res.status() >= 400) console.log('RESPONSE:', res.status(), res.url()); });

  // Click "Get Started" under the "Create Research Proposals" card
  const card = page.locator('div', { hasText: 'Create Research Proposals in minutes with AI' }).first();
  await page.locator('button:has-text("Get Started")').first().click();
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:/Temp/rv_13_wizard_start.png' });

  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
