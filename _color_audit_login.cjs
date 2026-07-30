const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3008/login', { waitUntil: 'networkidle' });

  const emailSel = 'input[type="email"], input[name="email"]';
  const passSel = 'input[type="password"], input[name="password"]';
  await page.waitForSelector(emailSel, { timeout: 15000 });
  await page.fill(emailSel, 'admin@humaniseai.com');
  await page.fill(passSel, 'Admin@123456');

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/auth/login'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForTimeout(2500);
  console.log('URL after login:', page.url());

  await context.storageState({ path: './_color_audit_authstate.json' });
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
