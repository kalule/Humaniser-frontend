const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('response', res => { console.log('RESP:', res.status(), res.url()); });

  console.log('Start URL:', page.url());
  await page.click('a:has-text("Proposal Studio")');
  await page.waitForTimeout(1200);
  await page.click('button:has-text("Get Started")');
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder*="AI Impact on Healthcare"]', 'Impact of Remote Work on Employee Productivity 3');
  await page.click('button:has-text("Create workspace")');

  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    console.log(`t+${i+1}s URL:`, page.url());
  }
  await page.screenshot({ path: 'C:/Temp/rv_18_settle.png' });

  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
