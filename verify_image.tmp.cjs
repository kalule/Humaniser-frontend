const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push('pageerror: ' + err.message))
  page.on('dialog', async dialog => {
    const msg = dialog.message()
    if (msg.includes('Image URL')) await dialog.accept('https://placehold.co/200x100')
    else await dialog.accept()
  })

  // Mock the refresh endpoint so the app believes we're logged in, avoiding
  // the real backend + the client.ts hard-redirect-to-/login on refresh failure.
  await page.route('**/api/v1/auth/refresh', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'fake-token',
          refreshToken: 'fake-refresh',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          user: {
            id: 'test-user', email: 'test@example.com', name: 'Test User',
            plan: 'Free', wordsUsed: 0, wordsLimit: 5000,
            isEmailVerified: true, role: 'User', createdAt: new Date().toISOString(),
          },
        },
      }),
    })
  })
  // Any other API call: return empty success so nothing else throws.
  await page.route('**/api/v1/**', route => {
    if (route.request().url().includes('/auth/refresh')) return route.continue()
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  })

  await page.goto('http://localhost:3005/app/editor/new', { waitUntil: 'networkidle' })
  await page.waitForSelector('.tiptap-paper .ProseMirror', { timeout: 20000 })
  console.log('Editor loaded OK, url:', page.url())

  const editor = page.locator('.tiptap-paper .ProseMirror')
  await editor.click()
  await page.keyboard.type('Testing image insertion')

  await page.click('button[title="Insert image"]')
  await page.waitForTimeout(200)
  const menuVisible = await page.locator('text=Upload from computer').isVisible().catch(() => false)
  console.log('Image dropdown menu visible:', menuVisible)
  await page.screenshot({ path: 'img_1_menu_open.png' })

  if (menuVisible) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }).catch(e => { errors.push('filechooser event error: ' + e.message); return null }),
      page.click('text=Upload from computer'),
    ])
    console.log('File chooser triggered:', !!fileChooser)
    if (fileChooser) {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      const tmpFile = path.join(__dirname, 'test.png')
      fs.writeFileSync(tmpFile, Buffer.from(pngBase64, 'base64'))
      await fileChooser.setFiles(tmpFile)
      await page.waitForTimeout(1000)
      const imgCount = await page.locator('.tiptap-paper img').count()
      console.log('Images in editor after upload:', imgCount)
      await page.screenshot({ path: 'img_2_after_upload.png' })
    }
  }

  await page.click('button[title="Insert image"]')
  await page.waitForTimeout(200)
  await page.click('text=By URL')
  await page.waitForTimeout(1000)
  const imgCount2 = await page.locator('.tiptap-paper img').count()
  console.log('Images in editor after URL insert:', imgCount2)
  await page.screenshot({ path: 'img_3_after_url.png' })

  console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2))
  await browser.close()
})()
