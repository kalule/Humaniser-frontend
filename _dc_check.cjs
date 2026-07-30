const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:3007/login', { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('goto login err', e.message));

  const emailSel = 'input[type="email"], input[name="email"]';
  const passSel = 'input[type="password"], input[name="password"]';
  const hasLogin = await page.locator(emailSel).count().catch(() => 0);
  console.log('login form present:', hasLogin);

  if (hasLogin) {
    await page.fill(emailSel, 'admin@humaniseai.com');
    await page.fill(passSel, 'Admin@123456');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/auth/login'), { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1500);
  }

  await page.goto('http://localhost:3007/app/document-chat', { waitUntil: 'networkidle', timeout: 20000 }).catch(e => console.log('goto doc-chat err', e.message));
  await page.waitForTimeout(1500);
  console.log('final URL:', page.url());
  await page.screenshot({ path: 'C:/Temp/dc_empty_state.png', fullPage: false });
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
