/** Dev-server smoke test with readable stack traces: node scripts/smoke-dev.mjs [route ...] */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
const server = await createServer({ server: { port: 4411, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--mute-audio'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('console', async (m) => {
  if (m.type() !== 'error') return;
  const args = await Promise.all(m.args().map((a) => a.evaluate((x) => (x instanceof Error ? x.stack : String(x))).catch(() => '?')));
  errors.push(args.join(' '));
});
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack ?? e)));
await page.goto('http://localhost:4411/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.setItem('other-half.save.v1', JSON.stringify({ v: 1, unlocked: 10, settings: { unlockAll: true } })));
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['level/1', 'level/4', 'level/5', 'level/6', 'arcade'];
for (const r of routes) {
  errors.length = 0;
  await page.goto(`http://localhost:4411/#/${r}`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((res) => setTimeout(res, 1500));
  console.log(`== ${r}: ${errors.length} errors`);
  for (const e of errors.slice(0, 2)) console.log(e.split('\n').slice(0, 6).join('\n'));
}
await browser.close();
await server.close();
