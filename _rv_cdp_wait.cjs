const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  await page.waitForTimeout(4000);
  await page.screenshot({ path: process.argv[2] || 'C:/Temp/rv_wait.png' });
  console.log('URL:', page.url());
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
