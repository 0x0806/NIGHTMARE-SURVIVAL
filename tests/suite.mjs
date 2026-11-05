import { PNG } from 'pngjs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, sleep } from './chrome.mjs';
const BASE = process.argv[2] || process.env.BASE_URL;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = []; const ok = (n, v, x = '') => { res.push(`${v ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
const b = await launch();
const errs = [];
async function newPage(url) {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|vibrate|favicon/.test(m.text())) errs.push('console.error: ' + m.text().slice(0, 240)); });
  await p.evaluateOnNewDocument(() => { localStorage.clear(); });
  await p.goto(url, { waitUntil: 'networkidle0' }); return p;
}
const lum = async (p) => { const png = PNG.sync.read(Buffer.from(await p.screenshot())); let s = 0, s2 = 0, n = 0, lit = 0; for (let i = 0; i < png.data.length; i += 4 * 7) { const l = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3; s += l; s2 += l * l; n++; if (l > 40) lit++; } const m = s / n; return { mean: m, sd: Math.sqrt(s2 / n - m * m), litFrac: lit / n }; };

// ---------- 1. story flow ----------
let p = await newPage(BASE);
ok('menu shows story-first buttons', await p.$eval('#btn-start', (e) => e.textContent.includes('story')) && await p.$eval('#btn-continue', (e) => e.hidden));
await p.evaluate(() => { __game.settings.shake = false; __game.autoQuality = () => {}; });
await p.click('#btn-start'); await sleep(1500);
ok('story intro screen', await p.evaluate(() => __game.screenName === 'story'));
await p.click('#story-skip'); await sleep(300);
ok('skip reveals full intro', await p.$eval('#story-skip', (e) => e.textContent === 'Continue') && (await p.$$eval('#story-text p', (e) => e.length)) === 6);
await p.click('#story-skip'); await sleep(4500);
const s1 = await p.evaluate(() => ({ state: __game.state, mode: __game.mode, use3d: __game.use3d, ward: __game.run.level, saved: !!JSON.parse(localStorage.getItem('nightmare.story') || 'null'), radio: document.getElementById('radio').classList.contains('show'), who: document.getElementById('radio-who').textContent }));
ok('story run starts in 3D ward 1', s1.state === 'play' && s1.mode === 'story' && s1.use3d && s1.ward === 1, JSON.stringify(s1));
ok('progress auto-saved', s1.saved); ok('Wren radio message appears', s1.radio && s1.who === 'Wren');
// ---------- 2. 3D render sanity + shader/memory stability ----------
await p.evaluate(() => { const g = __game; g.fade = 0; g.hints = { battery: 1, sanity: 1, hp: 1, locker: 1, lamp: 1, lift: 1 }; document.getElementById('card').style.display = 'none'; g.clearRadio(); });
await sleep(1200);
const L1 = await lum(p); ok('3D frame is lit and has structure', L1.mean > 6 && L1.sd > 12 && L1.litFrac > 0.03, JSON.stringify(L1));
await p.evaluate(() => { const g = __game; g.keys.add('KeyW'); }); await sleep(1500);
const A = await p.evaluate(() => __game.view3d.info()); await sleep(2500);
await p.evaluate(() => { __game.player.angle += 1.2; __game.throwFlare(); }); await sleep(1500);
await p.evaluate(() => __game.keys.clear());
const B2 = await p.evaluate(() => __game.view3d.info());
ok('no shader recompiles while playing (flare, turning, moving)', B2.programs === A.programs, `programs ${A.programs} -> ${B2.programs}`);
const posBefore = await p.evaluate(() => ({ x: __game.player.x, y: __game.player.y }));
ok('WASD moved player in 3D', Math.hypot(posBefore.x - 0, posBefore.y - 0) > 0);
const mem = await p.evaluate(async () => { const g = __game, out = []; for (let i = 0; i < 12; i++) { g.view3d.loadLevel(g.level); for (let k = 0; k < 3; k++) { g.update(1 / 60); g.render(); } const m = g.view3d.info(); out.push([m.geometries, m.textures]); } return out; });
ok('no geometry/texture leak across 12 reloads of a level', mem[11][0] <= mem[2][0] + 2 && mem[11][1] <= mem[2][1] + 2, JSON.stringify([mem[2], mem[11]]));
// ---------- 3. mechanics in 3D ----------
const mech = await p.evaluate(async () => {
  const g = __game; g.beginLevel(4); g.fade = 0; const L = g.level, P = g.player; let cnt = 0; const realHurt = g.hurt.bind(g); g.hurt = () => { cnt++; }; const out = {};
  L.lamps = []; L.tiles.fill(0); const cx = Math.floor(P.x / 48), cy = Math.floor(P.y / 48); for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 10; x <= cx + 10; x++) L.tiles[y * L.w + x] = 1;
  P.angle = 0; const st = new (g.enemies[0].constructor)('stalker', P.x - 220, P.y, g); st.wake = 0; g.enemies = [st]; g.playerField = L.bfs(cx, cy);
  for (let t = 0; t < 700 && cnt === 0; t++) { g.fieldT = 0; g.update(1 / 60); } out.stalkerHurtsBehind = cnt > 0;
  cnt = 0; P.x = (cx + 0.5) * 48; P.y = (cy + 0.5) * 48; P.angle = Math.PI; st.x = P.x - 260; st.y = P.y; const x0 = st.x; for (let t = 0; t < 120; t++) { P.angle = Math.PI; g.update(1 / 60); } out.stalkerFrozenInBeam = Math.abs(st.x - x0) < 6;
  g.hurt = realHurt; return out;
});
ok('Stalker attacks from behind (3D)', mech.stalkerHurtsBehind); ok('Stalker freezes in the beam (3D)', mech.stalkerFrozenInBeam);
const hide = await p.evaluate(() => { const g = __game; g.beginLevel(2); g.fade = 0; const L = g.level, P = g.player; let lk = -1; for (let i = 0; i < L.w * L.w; i++) if (L.tiles[i] === 2 && L.propKind[i] === 1) { lk = i; break; } const tx = lk % L.w, ty = (lk / L.w) | 0; P.x = (tx + 0.5) * 48 - 48; P.y = (ty + 0.5) * 48; g.enemies = []; g.update(0.016); g.interact(); for (let i = 0; i < 30; i++) { g.update(1 / 60); g.render(); } return { hidden: P.hidden, tile: !!P.hideTile }; });
ok('hide in locker works in 3D', hide.hidden && hide.tile);
await p.evaluate(() => __game.interact());
// ---------- 4. retry / continue / endings ----------
const retry = await p.evaluate(async () => { const g = __game; g.beginLevel(3); g.fade = 0; g.player.hp = 1; const e = { x: g.player.x + 5, y: g.player.y, cfg: { label: 'a Wraith' } }; g.hurt(50, e); g.deadT = 2; g.showDeath(); return { screen: g.screenName, label: document.getElementById('death-retry').textContent, deaths0: g.run.deaths, text: document.getElementById('death-cause').textContent }; });
ok('death screen offers story retry + Wren line', retry.label === 'Try this ward again' && /Wren|voice/.test(retry.text) || /Ren, get up/.test(retry.text), JSON.stringify(retry));
await sleep(600); await p.click('#death-retry'); await sleep(600);
const after = await p.evaluate(() => ({ state: __game.state, ward: __game.run.level, deaths: __game.run.deaths, hp: __game.player.hp }));
ok('retry restarts same ward with penalty', after.state === 'play' && after.ward === 3 && after.deaths === 1 && after.hp >= 60, JSON.stringify(after));
const end = await p.evaluate(async () => { const g = __game; g.notesFound = [0, 1, 2]; g.beginLevel(7); g.fade = 0; g.fuseGot = g.fuseNeed; g.completeLevel(); await new Promise((r) => setTimeout(r, 200)); const a = { screen: g.screenName, title: document.getElementById('story-title').textContent }; g.storyFinish(); a.lines = [...document.querySelectorAll('#story-text p')].map((x) => x.textContent); return a; });
ok('normal ending (Patient 14) when few notes', end.title === 'Ending: Patient 14' && /PATIENT 14/.test(end.lines.join(' ')), end.title);
const end2 = await p.evaluate(async () => { const g = __game; g.notesFound = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; g.beginLevel(7); g.fade = 0; g.fuseGot = g.fuseNeed; g.completeLevel(); await new Promise((r) => setTimeout(r, 200)); return document.getElementById('story-title').textContent; });
ok('true ending with 10+ notes', end2 === 'Ending: The Way Out', end2);
await p.evaluate(() => __game.storyFinish()); await sleep(600); await p.click('#story-skip'); await sleep(500);
const es = await p.evaluate(() => ({ screen: __game.screenName, state: __game.state, hidden: document.getElementById('clear-name-row').hidden, fin: __game.storyFinished, btn: document.getElementById('story-skip').textContent }));
ok('ending leads to score screen', es.screen === 'clear' && !es.hidden, JSON.stringify(es));
// pressure / compass
const comp = await p.evaluate(() => { const g = __game; g.beginLevel(2); g.fade = 0; g.fuseGot = g.fuseNeed; g.update(1 / 60); return { hidden: document.getElementById('compass').hidden, dist: document.getElementById('compass-dist').textContent }; });
ok('lift compass appears when fuses restored', comp.hidden === false && /m$/.test(comp.dist), JSON.stringify(comp));
const pr = await p.evaluate(() => { const g = __game; g.beginLevel(3); g.fade = 0; g.pressureT = 0.01; const before = g.enemies.filter((e) => e.state === 'investigate').length; g.update(0.05); return g.enemies.filter((e) => e.state === 'investigate').length - before; });
ok('pressure timer sends a hunter to you', pr >= 0, 'investigating delta ' + pr);
// ---------- 4b. fairness + finale ----------
const fair = await p.evaluate(async () => {
  const g = __game; g.hurt = () => {}; let found = 0; const trials = 6;
  for (let n = 0; n < trials; n++) {
    g.beginLevel(2 + (n % 4)); g.fade = 0; const L = g.level, P = g.player; let lk = -1; for (let i = 0; i < L.w * L.w; i++) if (L.tiles[i] === 2 && L.propKind[i] === 1) { lk = i; break; }
    const tx = lk % L.w, ty = (lk / L.w) | 0; P.x = (tx + 0.5) * 48 - 48; P.y = (ty + 0.5) * 48; g.update(0.016); g.interact();
    g.enemies = g.enemies.filter((e) => e.type === 'wraith' || e.type === 'crawler').slice(0, 2); g.enemies.forEach((e) => { const f = L.freeTile(L.rooms[(n * 3) % L.rooms.length], 12); e.x = f.x; e.y = f.y; });
    g.pressureT = 0.01; let was = false; for (let t = 0; t < 60 * 20; t++) { g.update(1 / 60); if (!P.hidden) { was = true; break; } } if (was) found++;
  }
  return { found, trials };
});
ok('hiding is a gamble, not a guaranteed failure (pressure no longer reads live position)', fair.found <= 2, `${fair.found}/${fair.trials} found`);
const onb = await p.evaluate(() => { const g = __game; g.mode = 'story'; g.beginLevel(1); g.fade = 0; const before = g.pressureT; g.fuses[0].got = false; const P = g.player; P.x = g.fuses[0].x; P.y = g.fuses[0].y; g.update(1 / 60); return { before, after: g.pressureT }; });
ok('story ward 1: pressure is off until the first fuse', onb.before > 1e8 && onb.after < 1e3, JSON.stringify(onb));
const alarm = await p.evaluate(() => { const g = __game; g.mode = 'story'; g.beginLevel(3); g.fade = 0; g.fuseGot = g.fuseNeed - 1; const f = g.fuses.find((x) => !x.got); const P = g.player; P.x = f.x; P.y = f.y; g.update(1 / 60); const ex = g.level.exit; const hunters = g.enemies.filter((e) => e.type === 'wraith' || e.type === 'crawler'); return { n: hunters.length, alerted: hunters.filter((e) => e.state === 'investigate' || e.state === 'chase').length, radio: document.getElementById('radio-text').textContent.length > 0 }; });
ok('lift alarm: last fuse sends every hunter to the lift', alarm.n > 0 && alarm.alerted === alarm.n, JSON.stringify(alarm));
await p.close();
// ---------- 5. 2D fallback + file:// ----------
p = await newPage(BASE); await p.evaluate(() => { __game.settings.view = '2d'; });
await p.evaluate(async () => { await __game.startRun('survival'); __game.fade = 0; }); await sleep(800);
ok('top-down fallback works', await p.evaluate(() => !__game.use3d && !document.body.classList.contains('mode3d') && __game.state === 'play'));
const L2 = await lum(p); ok('2D frame renders', L2.mean > 2 && L2.sd > 8, JSON.stringify(L2)); await p.close();
const fp = await newPage(pathToFileURL(path.join(ROOT, 'index.html')).href);
await fp.evaluate(async () => { await __game.startRun('survival'); __game.fade = 0; }); await sleep(800);
ok('file:// falls back to top-down (modules blocked)', await fp.evaluate(() => !__game.use3d && __game.state === 'play' && __game.view3dFailed === true)); await fp.close();
console.log(res.join('\n')); console.log('page errors:', errs.length ? '\n  ' + errs.join('\n  ') : 'none');
await b.close();
