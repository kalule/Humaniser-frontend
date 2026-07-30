const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ignoreHTTPSErrors: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('response', res => {
    if (res.url().includes('/auth') || res.status() >= 400) {
      console.log('RESPONSE:', res.status(), res.url());
    }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  const emailSel = 'input[type="email"], input[name="email"]';
  const passSel = 'input[type="password"], input[name="password"]';
  await page.waitForSelector(emailSel, { timeout: 15000 });
  await page.fill(emailSel, 'admin@humaniseai.com');
  await page.fill(passSel, 'Admin@123456');

  const [resp] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/auth/login'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  if (resp) {
    console.log('LOGIN RESPONSE STATUS:', resp.status());
    try { console.log('LOGIN RESPONSE BODY:', await resp.text()); } catch (e) {}
  } else {
    console.log('No /auth/login response captured');
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Temp/rv_04_final.png' });
  console.log('URL after login:', page.url());

  await context.storageState({ path: 'C:/Temp/rv_authstate.json' });
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
