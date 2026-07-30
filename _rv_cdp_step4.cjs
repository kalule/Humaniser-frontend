const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  page.on('response', res => { if (res.status() >= 400) console.log('RESPONSE:', res.status(), res.url()); });

  await page.fill('input[placeholder*="AI Impact on Healthcare"]', 'Impact of Remote Work on Employee Productivity');
  await page.click('button:has-text("Create workspace")');
  await page.waitForTimeout(2500);
  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:/Temp/rv_14_workspace_created.png' });

  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
