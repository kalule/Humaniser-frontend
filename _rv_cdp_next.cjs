const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  page.on('response', res => { if (res.status() >= 400) console.log('RESP:', res.status(), res.url()); });

  await page.click('button:has-text("Next: Location")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Temp/rv_21_location.png' });
  console.log('URL:', page.url());

  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
