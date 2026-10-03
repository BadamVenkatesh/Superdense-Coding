/** Performance check: load time, FPS during a mission, JS heap. node scripts/perf.mjs (after build) */
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
const server = await preview({ preview: { port: 4320, strictPort: true }, logLevel: 'silent' });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--mute-audio'] });
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
await page.goto('http://localhost:4320/', { waitUntil: 'load' });
const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
  const bytes = performance.getEntriesByType('resource').reduce((t, r) => t + (r.transferSize || 0), 0) + (n.transferSize || 0);
  return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round(fcp ?? -1), kbTransferred: Math.round(bytes / 1024) };
});
console.log('load', nav, `wall ${Date.now() - t0} ms`);
await page.evaluate(() => localStorage.setItem('other-half.save.v1', JSON.stringify({ v: 1, unlocked: 10, settings: { unlockAll: true } })));
await page.goto('about:blank');
await page.goto('http://localhost:4320/#/level/10', { waitUntil: 'load' });
await sleep(500);
await page.keyboard.press(' ');
for (let i = 0; i < 12; i++) { await page.keyboard.press('s'); await sleep(1500); }
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else res(Math.round(n / 3)); }; requestAnimationFrame(f); }));
const m = await page.metrics();
console.log('mission fps', fps, 'heap MB', (m.JSHeapUsedSize / 1048576).toFixed(1), 'nodes', m.Nodes, 'listeners', m.JSEventListeners);
await browser.close();
server.httpServer.close();
