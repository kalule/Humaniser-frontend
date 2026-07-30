const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('response', res => { if (res.status() >= 400) console.log('RESPONSE:', res.status(), res.url()); });

  await page.goto('http://localhost:3000/app/proposal-studio', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Get Started")');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder*="AI Impact on Healthcare"]', 'Impact of Remote Work on Employee Productivity 2');
  await page.click('button:has-text("Create workspace")');
  await page.waitForTimeout(1000);
  console.log('URL right after create:', page.url());
  await page.waitForTimeout(4000);
  console.log('URL after wait:', page.url());
  await page.screenshot({ path: 'C:/Temp/rv_16_retry.png' });

  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
