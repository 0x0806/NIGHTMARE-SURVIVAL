import { launch } from './chrome.mjs';
const BASE = process.argv[2] || process.env.BASE_URL;
const b = await launch();
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(BASE, { waitUntil: 'networkidle0' });
const out = await p.evaluate(async () => {
  const g = __game; g.settings.shake = false; g.settings.quality = 'low'; g.autoQuality = () => {}; await g.startRun('survival'); const res = []; const info0 = []; 
  g.hurt = () => {}; g.die = () => {}; const TS = 48;
  for (let n = 1; n <= 9; n++) {
    g.beginLevel(n); g.fade = 0; const L = g.level, P = g.player; let cleared = false; const cl = g.completeLevel.bind(g); g.completeLevel = () => { cleared = true; };
    const goals = [...g.fuses, { x: L.exit.x, y: L.exit.y, ex: true }]; let steps = 0;
    for (let t = 0; t < 60 * 150 && !cleared; t++) {
      P.hp = 100; P.sanity = Math.max(P.sanity, 50); P.battery = Math.max(P.battery, 30);
      const g0 = goals.find((q) => !q.got && !(q.ex && g.fuseGot < g.fuseNeed)) || goals[goals.length - 1];
      const fld = L.bfs(Math.floor(g0.x / TS), Math.floor(g0.y / TS)); const tx = Math.floor(P.x / TS), ty = Math.floor(P.y / TS);
      let best = fld[ty * L.w + tx], bx = tx, by = ty; for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = fld[(ty + j) * L.w + tx + i]; if (v >= 0 && v < best) { best = v; bx = tx + i; by = ty + j; } }
      const dx = (bx + 0.5) * TS - P.x, dy = (by + 0.5) * TS - P.y; P.angle = Math.atan2(dy, dx); g.keys.clear(); g.keys.add('KeyW'); g.keys.add('ShiftLeft');
      g.update(1 / 60); if (t % 25 === 0) g.render(); steps++;
    }
    g.completeLevel = cl; g.keys.clear(); const i = g.view3d.info(); res.push(`W${n}:${cleared ? 'CLEAR' : 'FAIL'}(${steps}) geo=${i.geometries} tex=${i.textures} prog=${i.programs}`);
  }
  return res;
});
const failed = out.filter((l) => !l.includes(':CLEAR')); console.log(out.join('\n')); console.log('errors:', errs.length ? errs.join('\n') : 'none'); console.log(failed.length || errs.length ? 'SOAK FAIL' : 'SOAK PASS'); await b.close(); process.exit(failed.length || errs.length ? 1 : 0);
