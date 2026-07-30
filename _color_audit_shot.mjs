import { chromium } from 'playwright';

const base = 'http://localhost:3008';
const outDir = 'C:\\Users\\42153\\AppData\\Local\\Temp\\claude\\c--Users-42153-OneDrive-Desktop-IT-Projects-Humaniser-frontend\\5f143ae8-3268-46c0-bf9e-91eb6908a1ac\\scratchpad';

const pages = [
  { path: '/app/grammar', name: 'grammar' },
  { path: '/app/summarise', name: 'summarise' },
  { path: '/app/paraphrase', name: 'paraphrase' },
  { path: '/app/document-chat', name: 'document-chat' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

for (const p of pages) {
  try {
    await page.goto(base + p.path, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outDir}\\${p.name}.png` });
    console.log('captured', p.name, page.url());
  } catch (e) {
    console.log('FAILED', p.name, e.message);
  }
}

await browser.close();
