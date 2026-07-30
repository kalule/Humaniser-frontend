const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  page.on('response', res => { if (res.status() >= 400) console.log('RESP:', res.status(), res.url()); });

  await page.fill('textarea', 'The impact of remote work arrangements on employee productivity, engagement, and wellbeing in knowledge-based organisations.');
  await page.screenshot({ path: 'C:/Temp/rv_19_topic_filled.png' });
  await page.click('button:has-text("Next: Research Title")');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:/Temp/rv_20_after_topic.png' });
  console.log('URL:', page.url());

  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
