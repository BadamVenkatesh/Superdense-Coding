/**
 * End-to-end playthrough in a real browser (system Chrome via puppeteer-core) against the
 * production build. Plays levels with the KEYBOARD ONLY, stress-tests input, checks
 * persistence, the circuit view, the lab and the mobile layout, and saves screenshots to
 * submission/screenshots/. Fails on any console error or failed check.
 *
 *   npm run build && npm run e2e
 */
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME_PATH
  ?? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
const SHOTS = resolve('submission/screenshots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
const shapingMisses = [];
let page;
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ` (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const key = async (k, n = 1, gap = 70) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await sleep(gap); } };
const text = (sel) => page.$eval(sel, (e) => e.textContent ?? '').catch(() => '');
const hash = () => page.evaluate(() => location.hash);
const overlayUp = () => page.$('.overlay .modal').then(Boolean);
const snap = () => page.evaluate(() => window.__otherHalf?.snapshot() ?? null);
/** Navigate with a real page load (a same-URL goto would keep the old screen alive). */
const fresh = async (path) => { await page.goto('about:blank'); await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' }); };
const waitFor = async (fn, ms = 15000, step = 100) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; };

const server = await preview({ preview: { port: 4317, strictPort: true }, logLevel: 'silent' });
const BASE = 'http://localhost:4317/';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-first-run'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

/** Plays one mission with the keyboard, reading only what the player can see. */
async function playMission({ seconds = 120, shotAt = [] } = {}) {
  await waitFor(overlayUp, 4000);
  await key('Space');
  const t0 = Date.now();
  let shotsTaken = 0;
  while (Date.now() - t0 < seconds * 1000) {
    const s = await snap();
    if (!s) break;
    if (s.status !== 'running') return s;
    const el = (Date.now() - t0) / 1000;
    if (shotsTaken < shotAt.length && el >= shotAt[shotsTaken].at) {
      await shot(shotAt[shotsTaken].name);
      shotsTaken++;
    }
    if (s.ready && !s.armed && !s.reserved && !s.risky) {
      if (s.classical) {
        if (s.target) await key('b', 1, 30);
      } else if (s.target && s.head && s.head !== '??') {
        let want = s.target;
        if (s.twist.X) want = want[0] + (want[1] === '1' ? '0' : '1');
        if (s.twist.Z) want = (want[0] === '1' ? '0' : '1') + want[1];
        if (s.head[1] !== want[1]) await key('f', 1, 30);
        if (s.head[0] !== want[0]) await key('p', 1, 30);
        const after = await snap();
        if (after && after.head !== want && after.target === s.target) shapingMisses.push(`t=${s.t.toFixed(2)} head ${s.head} → ${after.head}, wanted ${want} (started ${after.started})`);
        await key('Space', 1, 30);
      } else if (s.target && s.head === '??') {
        await key('Space', 1, 30);
      } else if (s.rack < s.cap) {
        await key('s', 1, 30);
      } else if (s.target) {
        await key('b', 1, 30);
      }
    }
    await sleep(60);
  }
  return snap();
}

try {
  page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  console.log('title');
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  check('title loads', (await text('.wordmark')).includes('OTHER'), `${Date.now() - t0} ms`);
  await sleep(1500);
  await shot('01-title');

  console.log('level 1: pair');
  await key('Space');
  await sleep(500);
  check('space on the title starts level 1', (await hash()) === '#/level/1');
  await shot('02-level1-start');
  await key('q');
  await sleep(300);
  await shot('03-level1-ask');
  const chip = await text('.history .res');
  check('asking both ▲▼ gives matching answers', /(▲▲|▼▼)=/.test(chip.replace(/\s/g, '')), chip);
  for (let i = 0; i < 2; i++) { await sleep(2500); await key('q'); }
  for (let i = 0; i < 3; i++) { await sleep(2500); await key('w'); }
  check('level 1 completes with a clear card', await waitFor(overlayUp, 4000));
  await shot('04-level1-clear');
  await key('Enter');
  await sleep(600);
  check('enter on the clear card goes to level 2', (await hash()) === '#/level/2');

  console.log('level 2: the link');
  const combos = [['q', 'o'], ['w', 'l'], ['q', 'l'], ['w', 'o']];
  for (let i = 0; i < 28 && !(await overlayUp()); i++) {
    const [a, b] = combos[i % 4];
    await key(a);
    await key(b);
    if (i === 5) await shot('05-level2-grid');
    await sleep(2400);
  }
  check('level 2 completes (grid filled)', await overlayUp());
  await key('Enter');
  await sleep(600);

  console.log('level 3: four moves');
  await key('f');
  await sleep(500);
  await shot('06-level3-cross');
  check('FLIP makes the link CROSS', (await text('.readout')).includes('CROSS'));
  await key('q');
  await sleep(2600);
  await key('p');
  await sleep(300);
  check('PHASE makes the link OFFBEAT', (await text('.readout')).includes('OFFBEAT'));
  await key('w');
  await sleep(2600);
  await key('f');
  await key('p');
  await sleep(400);
  check('FLIP + PHASE makes ANTI', (await text('.readout')).includes('ANTI'));
  await shot('07-level3-anti');
  await key('q');
  await sleep(2600);
  await key('f');
  await key('o');
  await sleep(500);
  const cap = await text('.stage-caption');
  check('Bob’s check of his half alone is a coin flip', cap.includes('can’t see your move'), cap);
  check('level 3 completes', await waitFor(overlayUp, 4000));
  await shot('08-level3-clear');
  await key('Enter');
  await sleep(600);

  console.log('level 4: the decoder');
  await sleep(1300);
  await key('q');
  await sleep(400);
  await shot('09-level4-struggle');
  await key('w');
  await sleep(300);
  check('asking ◀ ▶ after ▲▼ is flagged as meaningless', (await text('.panel')).includes('meaningless'));
  await key('0'); await key('0');
  await sleep(2600);
  await key('q');
  await key('0'); await key('1');
  await sleep(2600);
  let wins = 0;
  for (let i = 0; i < 8 && !(await overlayUp()); i++) {
    await sleep(400);
    await key('a');
    await sleep(800);
    if (i === 0) await shot('10-level4-analyzer');
    await sleep(900);
    await key('Enter');
    wins++;
    await sleep(1900);
  }
  check('level 4 completes with the analyzer', await waitFor(overlayUp, 4000), `${wins} analyzer rounds`);
  await key('Enter');
  await sleep(600);

  console.log('level 5: one qubit (signature)');
  check('level 5 opens', (await hash()) === '#/level/5');
  await key('f');
  await key('p');
  await sleep(300);
  await key('Space');
  await sleep(1700);
  await shot('11-level5-ceiling');
  check('a lone qubit delivers only one bit', (await text('.readout')).includes('?'));
  await key('Enter');
  await sleep(400);
  for (let n = 0; n < 4; n++) {
    await key('s');
    await sleep(2200);
    const bits = (await text('.msg .bits')).trim();
    if (n === 0) {
      check('the first paired message is 11 again', bits === '11', bits);
      await shot('12-level5-shared');
    }
    if (bits[1] === '1') await key('f');
    if (bits[0] === '1') await key('p');
    await sleep(300);
    if (n === 0) await shot('13-level5-shaped');
    await key('Space');
    await sleep(n === 0 ? 3100 : 4700);
    if (n === 0) {
      const banner = await text('.banner .big');
      check('the signature banner appears', banner.includes('ONLY ONE QUBIT'), banner);
      await shot('14-level5-one-qubit');
      await sleep(3300);
    }
  }
  check('level 5 completes', await waitFor(overlayUp, 6000));
  await shot('15-level5-clear');

  // Make the remaining sections independent of the playthrough above.
  await page.evaluate(() => {
    const k = 'other-half.save.v1';
    const d = JSON.parse(localStorage.getItem(k) || '{}');
    d.settings = { ...(d.settings || {}), unlockAll: true };
    localStorage.setItem(k, JSON.stringify(d));
  });

  console.log('circuit view');
  await fresh('#/level/5');
  await sleep(500);
  await key('v');
  await sleep(200);
  await key('Space');
  await sleep(1700);
  await key('Enter');
  await key('s');
  await sleep(2300);
  await key('f');
  await sleep(300);
  check('CIRCUIT view shows formal names', (await text('.readout')).includes('Ψ'));
  await shot('16-circuit-view');
  await key('v');

  console.log('level 6: dead drop (mission)');
  await fresh('#/level/6');
  const r6 = await playMission({ seconds: 60, shotAt: [{ at: 6, name: '17-level6-mission' }] });
  check('level 6 is won with every link shaped right', r6?.status === 'won' && r6.stats.wrong === 0, `${r6?.stats.correct} correct; failures ${JSON.stringify(r6?.failures)}`);
  await sleep(600);
  await shot('18-mission-clear');

  console.log('level 7: rush hour');
  await fresh('#/level/7');
  await shot('19-level7-intro');
  const r7 = await playMission({ seconds: 80, shotAt: [{ at: 12, name: '20-level7-banked' }, { at: 19, name: '21-level7-rush' }] });
  check('level 7 is won by banking pairs', r7?.status === 'won', `${r7?.stats.correct} correct, ${r7?.stats.expired} expired`);
  check('pairs were shared before their messages existed', (r7?.stats.preSharedUsed ?? 0) >= 6, String(r7?.stats.preSharedUsed));

  console.log('level 7 classical');
  await fresh('#/level/7/classical');
  const rc = await playMission({ seconds: 80, shotAt: [{ at: 24, name: '22-level7-classical' }] });
  check('the same rush is lost without entanglement', rc?.status === 'lost' && (rc?.stats.bitSends ?? 0) > 4, `${rc?.stats.correct} correct, ${rc?.stats.bitSends} lone qubits sent`);

  console.log('level 8: static zones');
  await fresh('#/level/8');
  const r8 = await playMission({ seconds: 75, shotAt: [{ at: 9, name: '23-level8-zone' }] });
  check('level 8 is won (zones cancelled or avoided)', r8?.status === 'won', `hits ${r8?.stats.hits}, wrong ${r8?.stats.wrong}`);

  console.log('level 9: wiretap');
  await fresh('#/level/9');
  const r9 = await playMission({ seconds: 60, shotAt: [{ at: 8, name: '24-level9-spy' }] });
  check('level 9 is won', r9?.status === 'won', `spy looks ${r9?.stats.spyReadings}`);

  console.log('level 10: last light');
  await fresh('#/level/10');
  const r10 = await playMission({ seconds: 110, shotAt: [{ at: 14, name: '25-level10-final' }] });
  check('level 10 (final) is won', r10?.status === 'won', `${r10?.stats.correct} correct, hearts ${r10?.hearts}`);
  await sleep(500);
  await shot('26-level10-clear');

  console.log('stress: key mashing mid-mission');
  await fresh('#/level/7');
  await key('Space');
  for (let i = 0; i < 120; i++) await page.keyboard.press(['f', 'p', 'Space', 's', 'b', 'Enter'][i % 6]);
  await sleep(500);
  check('mashing keys never breaks the mission', (await snap())?.status === 'running');
  await key('Escape');
  await sleep(300);
  check('Esc pauses', (await text('.modal h2')) === 'Paused');
  await key('Escape');
  await sleep(200);

  console.log('persistence');
  await fresh('#/levels');
  await page.reload({ waitUntil: 'networkidle0' });
  const stars = await page.$$eval('.level-tile .st', (els) => els.map((e) => (e.textContent.match(/★/g) || []).length));
  check('stars survive a reload', stars.slice(0, 5).every((n) => n === 3), stars.join(','));
  await shot('27-levels');

  console.log('lab + how');
  await fresh('#/lab');
  await page.$$eval('.lab-row .btn', (bs) => bs.find((b) => b.textContent.trim() === '11')?.click());
  await sleep(300);
  check('lab: preset 11 is Ψ⁻', (await text('.ket')).includes('0.707|01⟩ − 0.707|10⟩'));
  await shot('28-lab');
  await fresh('#/how');
  await shot('29-how-to-play');

  console.log('arcade');
  await fresh('#/arcade');
  const ra = await playMission({ seconds: 30, shotAt: [{ at: 26, name: '30-arcade' }] });
  check('arcade runs', (ra?.stats.correct ?? 0) > 0);

  console.log('storage blocked');
  const p2 = await browser.newPage();
  await p2.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(String(e)));
  await p2.goto(`${BASE}#/level/1`, { waitUntil: 'networkidle0' });
  await sleep(500);
  check('game runs with storage blocked', errs2.length === 0 && (await p2.$('canvas.stage')) !== null);
  await p2.close();

  console.log('mobile');
  const mob = await browser.newPage();
  mob.on('pageerror', (e) => errors.push(String(e)));
  await mob.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await mob.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(800);
  await mob.screenshot({ path: `${SHOTS}/31-mobile-title.png` });
  await mob.goto(`${BASE}#/level/5`, { waitUntil: 'networkidle0' });
  await sleep(700);
  await mob.screenshot({ path: `${SHOTS}/32-mobile-level5.png` });
  await mob.goto(`${BASE}#/level/7`, { waitUntil: 'networkidle0' });
  await sleep(500);
  await mob.tap('.overlay .btn.primary');
  await sleep(300);
  for (let i = 0; i < 4; i++) { await mob.tap('#app .controls .bob-btn'); await sleep(1700); }
  await mob.screenshot({ path: `${SHOTS}/33-mobile-mission.png` });
  const scrollW = await mob.evaluate(() => document.documentElement.scrollWidth);
  check('mobile: no horizontal scroll', scrollW <= 392, String(scrollW));
  const rack = await mob.evaluate(() => window.__otherHalf?.snapshot().rack);
  check('mobile: tapping SHARE banks pairs', rack >= 3, String(rack));
  await mob.close();
} catch (err) {
  console.error(err);
  check('no exception during the run', false, String(err));
} finally {
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('FLIP/PHASE key presses always reshape the link as intended', shapingMisses.length === 0, shapingMisses.slice(0, 3).join(' | '));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
