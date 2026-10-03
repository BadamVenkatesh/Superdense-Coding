/**
 * Cross-browser smoke test in Firefox (WebDriver BiDi via puppeteer-core).
 * Snap-packaged Firefox can't read /tmp: run with TMPDIR=~/snap/firefox/common/tmp
 *   npm run build && TMPDIR=~/snap/firefox/common/tmp npm run smoke:firefox
 */
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
const server = await preview({ preview: { port: 4318, strictPort: true }, logLevel: 'silent' });
const errors = [];
const checks = [];
const check = (n, ok, d = '') => { checks.push(ok); console.log(`${ok ? '  ✓' : '  ✗'} ${n}${d ? ` (${d})` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ browser: 'firefox', executablePath: process.env.FIREFOX_PATH ?? '/usr/bin/firefox', headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:4318/', { waitUntil: 'load' });
  await sleep(1200);
  check('title renders', (await page.$eval('.wordmark', (e) => e.textContent)).includes('OTHER'));
  await page.keyboard.press(' ');
  await sleep(700);
  await page.keyboard.press('q');
  await sleep(500);
  const chip = await page.$eval('.history .res', (e) => e.textContent.replace(/\s/g, ''));
  check('level 1: both halves agree', /(▲▲|▼▼)=/.test(chip), chip);
  await page.evaluate(() => localStorage.setItem('other-half.save.v1', JSON.stringify({ v: 1, unlocked: 10, settings: { unlockAll: true } })));
  await page.goto('about:blank');
  await page.goto('http://localhost:4318/#/level/6', { waitUntil: 'load' });
  await sleep(800);
  await page.keyboard.press(' ');
  await sleep(1600);
  const s = await page.evaluate(() => window.__otherHalf?.snapshot());
  check('mission runs', s?.status === 'running' && s.t > 0.5, `t=${s?.t?.toFixed(1)}`);
  if (s?.target) {
    if (s.target[1] === '1') await page.keyboard.press('f');
    if (s.target[0] === '1') await page.keyboard.press('p');
    await page.keyboard.press(' ');
    await sleep(2200);
    const s2 = await page.evaluate(() => window.__otherHalf?.snapshot());
    check('one qubit sent, two bits decoded', s2?.stats.correct === 1, JSON.stringify(s2?.stats.correct));
  }
  await page.goto('http://localhost:4318/#/lab', { waitUntil: 'load' });
  await sleep(500);
  check('lab renders', (await page.$eval('.ket', (e) => e.textContent)).includes('|00⟩'));
} catch (e) {
  check('no exception', false, String(e));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const ok = checks.every(Boolean);
console.log(ok ? 'firefox smoke: PASS' : 'firefox smoke: FAIL');
process.exit(ok ? 0 : 1);
