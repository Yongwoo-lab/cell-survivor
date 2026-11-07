// 자동 점검: 실제 게임을 헤드리스 Chrome으로 돌리며 콘솔 오류, DOM 상태, 수치 로그로 확인한다.
// 실행: npm run qa            (자동 시연 장시간 점검 기본 600초)
//       QA_LONG=60 npm run qa (빠르게)
//       QA_ONLY=flicker,flow npm run qa (일부만)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const LONG = Number(process.env.QA_LONG ?? 600);
const ONLY = process.env.QA_ONLY?.split(',');
const results = [];
const allLogs = [];

const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 페이지보다 먼저 실행: 이벤트 리스너·타이머·rAF·오디오 노드 수를 센다
const INSTRUMENT = () => {
  const q = (window.__qaStats = { listeners: 0, timeouts: new Set(), intervals: new Set(), raf: 0, oscCreated: 0, audioActive: 0, frames: 0 });
  const reg = new WeakMap();
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const keyOf = (t, o) => `${t}|${typeof o === 'object' ? !!o?.capture : !!o}`;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    // 오디오 노드는 재생이 끝나면 함께 사라지므로 세지 않는다
    if (f && !(typeof o === 'object' && o?.once) && !(this instanceof AudioNode)) {
      let m = reg.get(this);
      if (!m) reg.set(this, (m = new Map()));
      const k = keyOf(t, o);
      if (!m.has(k)) m.set(k, new Set());
      if (!m.get(k).has(f)) { m.get(k).add(f); q.listeners++; }
    }
    return add.call(this, t, f, o);
  };
  EventTarget.prototype.removeEventListener = function (t, f, o) {
    const s = reg.get(this)?.get(keyOf(t, o));
    if (s?.delete(f)) q.listeners--;
    return rem.call(this, t, f, o);
  };
  const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
  window.setTimeout = (fn, ms, ...a) => { let id; id = st(() => { q.timeouts.delete(id); typeof fn === 'function' && fn(...a); }, ms); q.timeouts.add(id); return id; };
  window.clearTimeout = (id) => { q.timeouts.delete(id); ct(id); };
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); q.intervals.add(id); return id; };
  window.clearInterval = (id) => { q.intervals.delete(id); ci(id); };
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => { q.raf++; return raf((t) => { q.raf--; fn(t); }); };
  window.cancelAnimationFrame = (id) => { q.raf--; caf(id); };
  const count = (start) => function (...a) { const n = start.apply(this, a); n.addEventListener('ended', () => q.audioActive--); const s = n.start.bind(n); n.start = (...b) => { q.audioActive++; return s(...b); }; return n; };
  const AC = window.AudioContext.prototype;
  const co = AC.createOscillator, cb = AC.createBufferSource;
  AC.createOscillator = function () { q.oscCreated++; return count(co).call(this); };
  AC.createBufferSource = count(cb);
  const tick = () => { q.frames++; raf(tick); };
  raf(tick);
};

const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
const BASE = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'],
});

async function open(name, { size = { width: 1600, height: 900 }, init } = {}) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`exception: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`http ${r.status()}: ${r.url().replace(BASE, '/')}`); });
  await page.addInitScript(INSTRUMENT);
  if (init) await page.addInitScript(init);
  await page.goto(`${BASE}?dev=1`);
  await page.waitForFunction(() => window.__qa, null, { timeout: 15000 });
  allLogs.push({ name, logs });
  return { page, ctx, logs };
}

const phase = (page) => page.evaluate(() => window.__qa.phase());
async function waitPhase(page, want, timeout = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await phase(page);
    if ((Array.isArray(want) ? want : [want]).includes(p)) return true;
    await sleep(100);
  }
  return false;
}
const visible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const st = getComputedStyle(el), r = el.getBoundingClientRect();
  return !el.closest('[hidden]') && st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
}, sel);
async function waitVisible(page, sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await visible(page, sel)) return true; await sleep(80); }
  return false;
}
const press = (page, ...keys) => keys.reduce((p, k) => p.then(() => page.keyboard.press(k)), Promise.resolve());
// 게임 시작 (타이틀에서 Enter → 콜드 오픈 Space로 건너뛰기)
async function startPlay(page) {
  await waitPhase(page, 'title');
  await sleep(300);
  await press(page, 'Enter');
  await waitPhase(page, 'cold', 3000);
  await sleep(300);
  await press(page, 'Space');
  return waitPhase(page, 'play', 3000);
}
const bossHp = (page, hp) => page.evaluate((v) => {
  const w = window.__qa.world(), e = w.enemies.f;
  for (let i = 0; i < w.enemies.count; i++) if (e.kind[i] === window.__qa.bossKind) e.hp[i] = v;
}, hp);
async function finishRanking(page) {
  await waitVisible(page, '#result', 10000);
  await sleep(1200);
  await press(page, 'Enter');
  if (!(await waitVisible(page, '#ranking', 3000))) return false;
  if (await page.evaluate(() => !!document.querySelector('#ranking .entry'))) { await press(page, 'KeyQ', 'KeyA', 'KeyZ', 'Enter'); await sleep(200); }
  await press(page, 'Enter');
  return waitPhase(page, 'title', 3000);
}
const stats = (page) => page.evaluate(() => {
  const q = window.__qaStats, i = window.__qa.info();
  return { listeners: q.listeners, timeouts: q.timeouts.size, intervals: q.intervals.size, raf: q.raf, audioActive: q.audioActive, oscCreated: q.oscCreated,
    geometries: i.geometries, textures: i.textures, programs: i.programs, particles: i.particles, enemies: i.enemies,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1 };
});

const tests = {
  // 전체 흐름 (승리): 건너뛰기 없이 콜드 오픈·프롤로그 → 1~3막 → 보스 → 승리 → 결과 → 랭킹 → 타이틀
  async flow() {
    const { page, ctx } = await open('flow');
    check('flow: title shows logo and menu', (await visible(page, '#title .logo')) && (await visible(page, '#title .menu button')));
    await press(page, 'Enter');
    check('flow: Enter starts cold open', (await waitPhase(page, 'cold', 2000)) && (await waitVisible(page, '#coldopen', 3000)));
    check('flow: cold open hands over to prologue', (await waitPhase(page, 'prologue', 10000)) && (await visible(page, '#prologue')));
    check('flow: prologue ends in play with HUD', (await waitPhase(page, 'play', 22000)) && (await waitVisible(page, '#hud')));
    await press(page, 'F7', 'F4');
    check('flow: level-up shows 3 cards', (await waitVisible(page, '#picker .card', 3000)) && (await page.locator('#picker .card').count()) === 3);
    await press(page, 'Digit1');
    await sleep(1200);
    check('flow: picking closes picker and fills deck', !(await visible(page, '#picker')) && (await page.locator('#deck .slot').count()) >= 1);
    await press(page, 'F1');
    check('flow: act 2 caption', await page.waitForFunction(() => document.querySelector('#act h2')?.textContent.includes('2막'), null, { timeout: 3000 }).then(() => true, () => false));
    await press(page, 'F2');
    check('flow: act 3 caption', await page.waitForFunction(() => document.querySelector('#act h2')?.textContent.includes('3막'), null, { timeout: 3000 }).then(() => true, () => false));
    await press(page, 'F3');
    check('flow: boss card and boss bar', (await page.waitForFunction(() => document.querySelector('#bosscard')?.classList.contains('on'), null, { timeout: 3000 }).then(() => true, () => false)) && (await waitVisible(page, '#hud .boss')));
    await sleep(2000);
    await bossHp(page, 0.01);
    check('flow: boss kill enters victory', await waitPhase(page, 'victory', 5000));
    check('flow: white flash', await page.waitForFunction(() => document.querySelector('#flash')?.classList.contains('on'), null, { timeout: 3000 }).then(() => true, () => false));
    check('flow: ending then result (won)', (await waitVisible(page, '#ending', 6000)) && (await waitVisible(page, '#result.won', 6000)));
    check('flow: result → ranking → title', await finishRanking(page));
    await ctx.close();
  },

  // 패배 흐름 + 콜드 오픈 건너뛰기
  async lose() {
    const { page, ctx } = await open('lose');
    check('lose: Space skips cold open', await startPlay(page));
    await page.evaluate(() => { const p = window.__qa.world().player; p.hp = 1; p.invuln = 0; });
    await press(page, 'F9');
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { await press(page, 'Digit1'); ok = await visible(page, '#ending'); await sleep(250); }
    check('lose: player death shows ending', ok);
    check('lose: result (lost)', await waitVisible(page, '#result.lost', 6000));
    check('lose: result → ranking → title', await finishRanking(page));
    await ctx.close();
  },

  // 프롤로그 건너뛰기
  async skip() {
    const { page, ctx } = await open('skip');
    await press(page, 'Enter');
    await waitPhase(page, 'prologue', 10000);
    await sleep(500);
    await press(page, 'Space');
    check('skip: Space skips prologue', await waitPhase(page, 'play', 2000));
    await ctx.close();
  },

  // 타이틀 깜빡임: 메뉴 위에서 마우스를 50번 오가는 동안 로고·메뉴가 다시 만들어지거나 등장 애니메이션이 다시 시작되면 안 된다
  async flicker() {
    const { page, ctx } = await open('flicker');
    await sleep(3500); // 첫 등장 연출이 끝나길 기다림
    await page.evaluate(() => {
      const t = document.querySelector('#title');
      window.__flick = { rebuilt: 0, anims: 0 };
      new MutationObserver((ms) => ms.forEach((m) => { if (m.type === 'childList' && (m.removedNodes.length || m.addedNodes.length)) window.__flick.rebuilt++; }))
        .observe(t, { childList: true, subtree: true });
      t.addEventListener('animationstart', (e) => { if (e.target.closest('.logo, .menu')) window.__flick.anims++; });
    });
    const buttons = await page.locator('#title .menu button').all();
    let alwaysVisible = true;
    for (let i = 0; i < 50; i++) {
      await buttons[i % buttons.length].hover();
      if (i % 5 === 0) alwaysVisible &&= await page.evaluate(() => [...document.querySelectorAll('#title .logo, #title .menu button')]
        .every((el) => +getComputedStyle(el).opacity > 0.95 && getComputedStyle(el).display !== 'none'));
    }
    const f = await page.evaluate(() => window.__flick);
    check('flicker: no DOM rebuild while hovering menu', f.rebuilt === 0, `rebuilt ${f.rebuilt}`);
    check('flicker: no restarted animations', f.anims === 0, `animationstart ${f.anims}`);
    check('flicker: logo and menu always visible', alwaysVisible);
    await ctx.close();
  },

  // 타이틀 ↔ 게임을 10번 오간 뒤 자원이 늘지 않는지
  async reentry() {
    const { page, ctx } = await open('reentry');
    const cycle = async () => {
      await startPlay(page);
      await sleep(1500);
      await press(page, 'Escape');
      await waitPhase(page, 'paused', 2000);
      await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');
      await waitPhase(page, 'title', 3000);
      await sleep(1500);
    };
    await cycle(); await cycle();
    const a = await stats(page);
    for (let i = 0; i < 8; i++) await cycle();
    const b = await stats(page);
    const grew = ['listeners', 'timeouts', 'intervals', 'raf', 'audioActive', 'geometries', 'textures', 'programs'].filter((k) => b[k] > a[k] + (k === 'timeouts' ? 3 : 0));
    check('reentry: 10 title↔game cycles leak nothing', grew.length === 0, grew.map((k) => `${k} ${a[k]}→${b[k]}`).join(', ') || `listeners ${b.listeners}, timeouts ${b.timeouts}, geometries ${b.geometries}`);
    await ctx.close();
  },

  // 자동 시연 장시간
  async long() {
    const { page, ctx } = await open('long');
    await waitPhase(page, 'demo', 40000);
    const samples = [];
    const t0 = Date.now();
    let lastFrames = await page.evaluate(() => window.__qaStats.frames);
    while (Date.now() - t0 < LONG * 1000) {
      await sleep(Math.min(30000, LONG * 1000 / 6));
      const s = await stats(page), f = await page.evaluate(() => window.__qaStats.frames);
      samples.push({ t: Math.round((Date.now() - t0) / 1000), heap: s.heap, enemies: s.enemies, particles: s.particles, fps: +((f - lastFrames) / (Math.min(30000, LONG * 1000 / 6) / 1000)).toFixed(1), phase: await phase(page) });
      lastFrames = f;
    }
    console.log('      t(s)  heap(MB)  enemies  particles  fps   phase');
    for (const s of samples) console.log(`      ${String(s.t).padStart(4)}  ${String(s.heap).padStart(8)}  ${String(s.enemies).padStart(7)}  ${String(s.particles).padStart(9)}  ${String(s.fps).padStart(4)}  ${s.phase}`);
    const half = samples.slice(Math.floor(samples.length / 2));
    const heapGrowth = Math.max(...half.map((s) => s.heap)) - Math.min(...samples.map((s) => s.heap));
    check(`long: ${LONG}s demo heap stable`, heapGrowth < 40, `growth ${heapGrowth}MB`);
    check('long: particles bounded', samples.every((s) => s.particles <= 3000));
    check('long: enemies bounded', samples.every((s) => s.enemies <= 1024));
    check('long: fps ≥ 55 on average', samples.reduce((a, s) => a + s.fps, 0) / samples.length >= 55, `avg ${(samples.reduce((a, s) => a + s.fps, 0) / samples.length).toFixed(1)}`);
    await ctx.close();
  },

  // 입력 경계 상황
  async edges() {
    const { page, ctx } = await open('edges');
    await startPlay(page);
    await press(page, 'F7', 'F4');
    await waitVisible(page, '#picker .card', 3000);
    await press(page, 'Escape', 'KeyP');
    check('edges: pause key ignored during card pick', !(await visible(page, '#pause')) && (await visible(page, '#picker')));
    const before = await page.evaluate(() => { const w = window.__qa.world(); return Object.values(w.cards).reduce((a, b) => a + b, 0) + Object.keys(w.evolved).length; });
    await press(page, 'Digit1', 'Digit2', 'Digit3', 'Digit1', 'Digit2');
    await sleep(1200);
    const after = await page.evaluate(() => { const w = window.__qa.world(); return Object.values(w.cards).reduce((a, b) => a + b, 0) + Object.keys(w.evolved).length; });
    check('edges: card key mashing picks exactly one', after - before === 1, `${before}→${after}`);
    await press(page, 'Escape');
    await waitPhase(page, 'paused', 2000);
    const m0 = await visible(page, '#muted');
    await press(page, 'KeyM');
    const m1 = await visible(page, '#muted');
    check('edges: M toggles sound while paused', m0 !== m1);
    await press(page, 'KeyM', 'Escape');
    check('edges: resume after pause', await waitPhase(page, 'play', 2000));
    // 보스 처치와 플레이어 사망이 같은 프레임
    await press(page, 'F3');
    await sleep(800);
    await page.evaluate(() => {
      const w = window.__qa.world(), e = w.enemies.f;
      w.player.hp = 0;
      for (let i = 0; i < w.enemies.count; i++) if (e.kind[i] === window.__qa.bossKind) e.hp[i] = 0;
    });
    await press(page, 'F7'); // 무적 해제
    check('edges: boss kill + death same frame resolves', (await waitPhase(page, ['victory', 'ending', 'result'], 4000)) && (await waitVisible(page, '#result', 9000)));
    // 결과 화면에서 포커스를 잃어도 계속 진행
    await page.evaluate(() => { window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(1200);
    await press(page, 'Enter');
    check('edges: blur on result screen does not block', await waitVisible(page, '#ranking', 3000));
    // 랭킹 이름 입력 중 다른 단축키
    if (await page.evaluate(() => !!document.querySelector('#ranking .entry'))) {
      await press(page, 'KeyM', 'KeyP', 'F4', 'KeyH', 'Escape', 'Digit1', 'KeyD', 'Enter');
      await sleep(200);
      const name = await page.evaluate(() => document.querySelector('#ranking .me b')?.textContent ?? '');
      check('edges: name entry takes only letters', name.replace(/[_\s]/g, '') === 'MPH', `"${name}"`);
    }
    await press(page, 'Enter');
    await waitPhase(page, 'title', 3000);
    // 프롤로그 중 키 연타
    await press(page, 'Enter');
    await waitPhase(page, 'prologue', 10000);
    for (let i = 0; i < 40; i++) await page.keyboard.press(['KeyA', 'Enter', 'ArrowLeft', 'KeyM', 'Digit1', 'Escape'][i % 6]);
    check('edges: key mashing in prologue still reaches play', await waitPhase(page, 'play', 22000));
    await ctx.close();
  },

  // 창 크기별로 UI가 화면 밖으로 넘치거나 겹치지 않는지
  async sizes() {
    const sizes = [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440]];
    const inside = (page, sels) => page.evaluate((ss) => ss.flatMap((s) => [...document.querySelectorAll(s)].filter((el) => !el.closest('[hidden]')).map((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) ? `${s} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]` : null;
    }).filter(Boolean)), sels);
    const overlap = (page, a, b) => page.evaluate(([a, b]) => {
      const A = document.querySelector(a), B = document.querySelector(b);
      if (!A || !B || A.closest('[hidden]') || B.closest('[hidden]')) return false;
      const r = A.getBoundingClientRect(), s = B.getBoundingClientRect();
      return r.width > 0 && s.width > 0 && r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom;
    }, [a, b]);
    for (const [w, h] of sizes) {
      const { page, ctx } = await open(`size ${w}x${h}`, { size: { width: w, height: h },
        init: () => localStorage.setItem('cell-survivor-ranking', JSON.stringify([{ name: 'QQQ', score: 99, date: new Date().toLocaleDateString('sv-SE'), at: 1 }])) });
      await sleep(3500);
      const bad = [...await inside(page, ['#title .logo', '#title .menu button', '#title .log', '#title .hint'])];
      if (await overlap(page, '#title .left', '#title .log')) bad.push('title .left overlaps .log');
      await startPlay(page);
      await press(page, 'F7', 'F4');
      await waitVisible(page, '#picker .card', 3000);
      await sleep(900);
      bad.push(...await inside(page, ['#picker .card', '#picker h2']));
      const cardsOverlap = await page.evaluate(() => { const r = [...document.querySelectorAll('#picker .card')].map((c) => c.getBoundingClientRect()); return r.some((a, i) => r.some((b, j) => i < j && a.right > b.left && b.right > a.left)); });
      if (cardsOverlap) bad.push('cards overlap');
      await press(page, 'Digit1');
      await sleep(1000);
      bad.push(...await inside(page, ['#hud', '#deck', '#pause-btn', '#scope .mag', '#scope .scalebar']));
      for (const [a, b] of [['#hud', '#pause-btn'], ['#deck', '#hud'], ['#scope .mag', '#hud'], ['#scope .sample', '#hud']]) if (await overlap(page, a, b)) bad.push(`${a} overlaps ${b}`);
      await press(page, 'Escape');
      await sleep(400);
      bad.push(...await inside(page, ['.pz', '.pz button']));
      await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter');
      await sleep(400);
      bad.push(...await inside(page, ['.cx', '.cx-detail']));
      await press(page, 'Escape', 'Escape');
      await waitPhase(page, 'play', 2000);
      await page.evaluate(() => { const p = window.__qa.world().player; p.hp = 0; });
      await press(page, 'F7');
      await waitVisible(page, '#result', 8000);
      await sleep(900);
      bad.push(...await inside(page, ['#result .rc', '#result .back']));
      check(`sizes: ${w}x${h} no overflow/overlap`, bad.length === 0, bad.slice(0, 4).join('; '));
      await ctx.close();
    }
  },

  // 저장소가 비었거나 깨졌을 때
  async storage() {
    for (const [label, init] of [['empty', () => localStorage.clear()], ['corrupt', () => {
      localStorage.setItem('cell-survivor-ranking', '{broken');
      localStorage.setItem('cell-survivor-codex', 'nope[');
      localStorage.setItem('cell-survivor-settings', '{{');
    }]]) {
      const { page, ctx, logs } = await open(`storage ${label}`, { init });
      const ok = (await waitVisible(page, '#title .menu button', 5000)) && (await startPlay(page));
      check(`storage: ${label} localStorage starts cleanly`, ok && logs.length === 0, logs[0] ?? '');
      await ctx.close();
    }
  },

  // 소리 켜기·끄기 반복
  async audio() {
    const { page, ctx } = await open('audio');
    await startPlay(page);
    await sleep(2000);
    const rate = async () => { const a = await stats(page); await sleep(2000); const b = await stats(page); return (b.oscCreated - a.oscCreated) / 2; };
    const r0 = await rate();
    for (let i = 0; i < 20; i++) await page.keyboard.press('KeyM');
    await sleep(500);
    const r1 = await rate();
    const s = await stats(page);
    check('audio: mute toggling does not stack playback', r1 <= r0 * 1.6 + 5 && s.intervals <= 2, `osc/s ${r0}→${r1}, intervals ${s.intervals}, active ${s.audioActive}`);
    await ctx.close();
  },
};

for (const [name, fn] of Object.entries(tests)) {
  if (ONLY && !ONLY.includes(name)) continue;
  console.log(`\n── ${name}`);
  try { await fn(); } catch (e) { check(`${name}: ran without crashing`, false, e.message.split('\n')[0]); }
}

console.log('\n── console');
const bad = allLogs.flatMap((l) => l.logs.map((m) => `[${l.name}] ${m}`));
check('console: no errors, warnings, or uncaught exceptions', bad.length === 0, `${bad.length}`);
for (const m of [...new Set(bad)].slice(0, 12)) console.log(`      ${m.slice(0, 200)}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
await server.close();
process.exit(failed.length ? 1 : 0);
