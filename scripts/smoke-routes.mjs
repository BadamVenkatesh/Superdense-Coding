/** Visit every route of the production build, screenshot it, fail on console errors. node scripts/smoke-routes.mjs [outDir] */
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const OUT = process.argv[2] ?? join(tmpdir(), 'other-half-routes');
mkdirSync(OUT, { recursive: true });
const server = await preview({ root: process.cwd(), preview: { port: 4410, strictPort: true }, logLevel: 'silent' });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--mute-audio', '--no-first-run'], defaultViewport: { width: 1440, height: 900 } });
const errors = [];
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:4410/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.setItem('other-half.save.v1', JSON.stringify({ v: 1, unlocked: 10, settings: { unlockAll: true } })));
const routes = ['', 'levels', 'level/1', 'level/2', 'level/3', 'level/4', 'level/5', 'level/6', 'level/7', 'level/10', 'arcade', 'lab', 'how', 'settings'];
for (const r of routes) {
  await page.goto(`http://localhost:4410/#/${r}`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/${(r || 'title').replace('/', '-')}.png` });
  console.log('ok', r || 'title');
}
console.log('ERRORS', errors.length, '· screenshots in', OUT);
for (const e of errors) console.log(e);
await browser.close();
server.httpServer.close();
process.exit(errors.length ? 1 : 0);
