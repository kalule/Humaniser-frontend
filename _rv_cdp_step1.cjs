const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  page.on('response', res => { if (res.status() >= 400) console.log('RESPONSE:', res.status(), res.url()); });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@humaniseai.com');
  await page.fill('input[type="password"]', 'Admin@123456');
  await Promise.all([
    page.waitForURL(/\/app\//, { timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);
  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:/Temp/rv_10_dashboard.png' });

  // Close onboarding modal via its X (top-right of dialog), then click Skip if a dialog remains
  for (let i = 0; i < 3; i++) {
    const dialogVisible = await page.locator('text=Welcome to HumaniseAI').isVisible().catch(() => false);
    if (!dialogVisible) break;
    const xBtn = page.locator('[role="dialog"] button, .fixed button').filter({ has: page.locator('svg') });
    const skipBtn = page.getByText('Skip', { exact: true });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
    } else if (await xBtn.first().isVisible().catch(() => false)) {
      await xBtn.first().click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: 'C:/Temp/rv_11_after_dismiss.png' });

  await browser.close(); // just disconnects, doesn't kill the launched server
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(1); });
