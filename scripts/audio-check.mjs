/**
 * Proves sound reaches the output: plays cues in real Chrome and reads the master meter.
 *   npm run build && node scripts/audio-check.mjs
 */
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
const server = await preview({ preview: { port: 4322, strictPort: true }, logLevel: 'silent' });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Peak RMS over a window, sampled every 20 ms. */
const peak = async (ms) => page.evaluate((ms) => new Promise((res) => { let p = 0; const t0 = performance.now(); const f = () => { p = Math.max(p, window.__otherHalfAudio.meter()); if (performance.now() - t0 < ms) setTimeout(f, 20); else res(p); }; f(); }), ms);
const checks = [];
const check = (n, ok, d = '') => { checks.push(ok); console.log(`${ok ? '  ✓' : '  ✗'} ${n}${d ? ` (${d})` : ''}`); };
await page.goto('http://localhost:4322/', { waitUntil: 'networkidle0' });
await page.mouse.click(5, 5); // a user gesture unlocks audio
await sleep(1500);
check('audio context is running after a gesture', (await page.evaluate(() => window.__otherHalfAudio.state())) === 'running');
const music = await peak(1500);
check('title music is audible', music > 0.002, music.toFixed(4));
await page.evaluate(() => localStorage.setItem('other-half.save.v1', JSON.stringify({ v: 1, unlocked: 10, settings: { unlockAll: true, music: false } })));
await page.goto('about:blank');
await page.goto('http://localhost:4322/#/level/1', { waitUntil: 'networkidle0' });
await page.mouse.click(5, 5);
await sleep(800);
const quiet = await peak(400);
await page.keyboard.press('q');
const fx = await peak(600);
check('with music off, the stage is quiet', quiet < 0.003, quiet.toFixed(4));
check('asking a question makes sound (answer + snap)', fx > 0.01, fx.toFixed(4));
await page.goto('about:blank');
await page.goto('http://localhost:4322/#/level/6', { waitUntil: 'networkidle0' });
await page.mouse.click(5, 5);
await sleep(300);
await page.keyboard.press(' ');
const go = await peak(700);
check('starting a mission plays the go cue', go > 0.01, go.toFixed(4));
await page.keyboard.press('m'); // mute
await sleep(300);
const muted = await peak(1500);
check('M mutes everything', muted < 0.002, muted.toFixed(4));
check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
server.httpServer.close();
const ok = checks.every(Boolean);
console.log(ok ? 'audio check: PASS' : 'audio check: FAIL');
process.exit(ok ? 0 : 1);
