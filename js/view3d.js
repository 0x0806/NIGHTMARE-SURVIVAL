/* Nightmare Survival — first-person 3D renderer (Three.js).
 * Reads the same simulation state as the top-down view: Level, Enemy list, pickups, flares, lamps.
 * Rules this file follows (they decide whether it stutters or leaks):
 *  - a FIXED pool of lights (never added/removed per frame, so shaders never recompile)
 *  - per-level geometry is disposed on loadLevel; textures are cached for the session
 *  - lit materials + dark fog: the flashlight reveals things; only eyes, fuses and exit lights are emissive
 *  - one fullscreen post pass: tone map, vignette, grain, sanity desaturation, damage tint, glitch, locker slats */
import * as THREE from '../vendor/three.module.min.js';

const TS = 48;                 // simulation tile size in px
const K = 3 / TS;              // sim px -> world units (one tile = 3 units)
const TILE = 3, WALL_H = 3.4, EYE = 1.62;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function rng32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const QUALITY = {
  low:    { scale: 0.55, shadow: 0,    pool: 3, msaa: 0, dprCap: 1 },
  medium: { scale: 0.85, shadow: 1024, pool: 4, msaa: 4, dprCap: 1.25 },
  high:   { scale: 1.0,  shadow: 2048, pool: 6, msaa: 4, dprCap: 1.5 },
};

/* ───────────── procedural textures ───────────── */
function makeTextures(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (size, draw, opts = {}) => {
    const c = document.createElement('canvas'); c.width = opts.w || size; c.height = opts.h || size;
    draw(c.getContext('2d'), c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  };
  const speck = (g, w, h, r, n, a, light) => { for (let i = 0; i < n; i++) { g.fillStyle = (light ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (r() * a).toFixed(3) + ')'; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); } };
  const blot = (g, w, h, r, n, rmin, rmax, col, amax) => { for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, rad = rmin + r() * (rmax - rmin), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col + (r() * amax).toFixed(3) + ')'); gr.addColorStop(1, col + '0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } };
  const crack = (g, w, h, r, n) => { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.2; for (let k = 0; k < n; k++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let i = 0; i < 7; i++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 40; g.lineTo(x, y); } g.stroke(); } };

  const floors = [];
  const bases = ['#4c5050', '#58605f', '#5a4331', '#3f4c44', '#33383a'];
  for (let kind = 0; kind < 5; kind++) {
    floors[kind] = [];
    for (let v = 0; v < 4; v++) {
      const r = rng32(kind * 97 + v * 13 + 5);
      floors[kind][v] = tex(256, (g, w, h) => {
        g.fillStyle = bases[kind]; g.fillRect(0, 0, w, h);
        if (kind === 1) { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = ((x + y) & 1) ? '#4d5655' : '#5f6867'; g.fillRect(x * 64, y * 64, 64, 64); g.fillStyle = `rgba(0,0,0,${(r() * 0.12).toFixed(3)})`; g.fillRect(x * 64, y * 64, 64, 64); } g.strokeStyle = '#1b1f1f'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }
        if (kind === 2) { for (let i = 0; i < 5; i++) { const y = i * 51.2; g.fillStyle = `rgba(${40 + r() * 40},${20 + r() * 20},10,.35)`; g.fillRect(0, y, w, 51); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(0,0,0,${(0.05 + r() * 0.1).toFixed(2)})`; g.lineWidth = 1; const yy = y + 3 + r() * 46; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + (r() - 0.5) * 5, w * 0.6, yy + (r() - 0.5) * 5, w, yy); g.stroke(); } const jx = r() * w; g.strokeStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.moveTo(jx, y); g.lineTo(jx, y + 51); g.stroke(); } }
        if (kind === 3) { g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + h, h); g.stroke(); } }
        blot(g, w, h, r, 14, 20, 70, 'rgba(0,0,0,', 0.22); blot(g, w, h, r, 6, 20, 60, 'rgba(255,255,255,', 0.05);
        if (r() < 0.5 || kind === 3) blot(g, w, h, r, 1 + ((r() * 2) | 0), 18, 55, 'rgba(95,8,10,', 0.7);
        speck(g, w, h, r, 900, 0.22, false); speck(g, w, h, r, 300, 0.07, true);
        if (kind !== 1 && r() < 0.5) crack(g, w, h, r, 2);
      });
    }
  }

  const walls = [];
  for (let v = 0; v < 4; v++) {
    const r = rng32(900 + v * 31);
    walls[v] = tex(256, (g, w, h) => {
      // plaster above, glazed tile wainscot below
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6c6b5d'); gr.addColorStop(0.55, '#7b7a6b'); gr.addColorStop(0.56, '#46534e'); gr.addColorStop(1, '#3c4743');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 1.5; for (let y = h * 0.57; y < h; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let x = 0; x < w; x += 28) { g.beginPath(); g.moveTo(x, h * 0.57); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = '#1c1e1c'; g.fillRect(0, h * 0.545, w, 5); g.fillRect(0, h - 10, w, 10); // dado rail, skirting
      blot(g, w, h, r, 16, 20, 80, 'rgba(0,0,0,', 0.28); blot(g, w, h, r, 5, 30, 90, 'rgba(70,60,20,', 0.25);
      const soot = g.createLinearGradient(0, 0, 0, h * 0.35); soot.addColorStop(0, 'rgba(0,0,0,.6)'); soot.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = soot; g.fillRect(0, 0, w, h * 0.35);
      for (let i = 0; i < 6; i++) { const x = r() * w, ln = 30 + r() * 120; const dg = g.createLinearGradient(0, 0, 0, ln); dg.addColorStop(0, 'rgba(40,30,10,.35)'); dg.addColorStop(1, 'rgba(40,30,10,0)'); g.save(); g.translate(x, r() * h * 0.3); g.fillStyle = dg; g.fillRect(0, 0, 3 + r() * 5, ln); g.restore(); }
      if (v === 1) { for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(95,10,12,.65)'; g.beginPath(); const x = 60 + r() * 130, y = 30 + r() * 80; g.ellipse(x, y, 5 + r() * 7, 9 + r() * 14, 0, 0, TAU); g.fill(); g.fillRect(x - 1, y, 3, 30 + r() * 70); } }
      if (v === 2) crack(g, w, h, r, 3);
      if (v === 3) { g.save(); g.translate(w * 0.5, h * 0.33); g.rotate(-0.05); g.fillStyle = 'rgba(110,12,14,.78)'; g.font = '44px "Special Elite", "Courier New", monospace'; g.textAlign = 'center'; g.fillText('LEAVE', 0, 0); g.restore(); }
      speck(g, w, h, r, 1000, 0.22, false); speck(g, w, h, r, 300, 0.06, true);
    });
  }

  const ceil = tex(256, (g, w, h) => {
    const r = rng32(4242); g.fillStyle = '#585a54'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    blot(g, w, h, r, 14, 20, 70, 'rgba(60,45,10,', 0.3); speck(g, w, h, r, 1200, 0.25, false);
  });

  const crate = tex(128, (g, w, h) => { const r = rng32(7); g.fillStyle = '#6a4b2c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.15})`; g.fillRect(0, i * 32, w, 3); } g.strokeStyle = '#2b1c0e'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.beginPath(); g.moveTo(3, 3); g.lineTo(w - 3, h - 3); g.moveTo(w - 3, 3); g.lineTo(3, h - 3); g.stroke(); speck(g, w, h, r, 300, 0.3, false); });
  const locker = tex(128, (g, w, h) => { const r = rng32(8); g.fillStyle = '#566567'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(w / 2 - 1, 0, 2, h); g.fillStyle = '#1d2425'; for (let i = 0; i < 5; i++) { g.fillRect(14, 10 + i * 5, 36, 2); g.fillRect(78, 10 + i * 5, 36, 2); } g.fillStyle = '#9aa3a0'; g.fillRect(50, h * 0.5, 4, 14); g.fillRect(74, h * 0.5, 4, 14); blot(g, w, h, r, 6, 10, 40, 'rgba(110,50,20,', 0.4); speck(g, w, h, r, 300, 0.25, false); });
  const bed = tex(128, (g, w, h) => { const r = rng32(9); g.fillStyle = '#b5b2a2'; g.fillRect(0, 0, w, h); blot(g, w, h, r, 5, 12, 40, 'rgba(95,10,12,', 0.7); blot(g, w, h, r, 6, 14, 40, 'rgba(0,0,0,', 0.2); g.strokeStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(0, r() * h); g.lineTo(w, r() * h); g.stroke(); } });
  const paper = tex(64, (g, w, h) => { g.fillStyle = '#d9d2ba'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b6451'; for (let i = 0; i < 9; i++) g.fillRect(8, 8 + i * 6, 12 + (i * 17) % 36, 1.5); });
  const exitSign = tex(256, (g, w, h) => { g.fillStyle = '#071109'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.font = 'bold 120px "Special Elite", "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', w / 2, h / 2 + 6); }, { h: 128 });
  const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  return { floors, walls, ceil, crate, locker, bed, paper, exitSign, glow };
}

/* Monster geometry is identical for every monster of a type, so build each shape once and share it. */
const GEO_CACHE = new Map();
function G(kind, ...args) {
  const key = kind + args.join(',');
  let g = GEO_CACHE.get(key);
  if (!g) { g = new THREE[kind + 'Geometry'](...args); g.userData.shared = true; GEO_CACHE.set(key, g); }
  return g;
}
const disp = (o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); };
const dispMats = (o) => { if (o.isMesh && o.material && !o.material.userData.sharedMat) o.material.dispose(); };

/* ───────────── monster models (face -Z; yaw applied by caller) ───────────── */
function buildEnemy(type, ghost) {
  const grp = new THREE.Group(), parts = {};
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x9fb0c0, transparent: true, opacity: 0.4, depthWrite: false, fog: true });
  const M = (color, rough = 0.85, emissive = 0x000000) => ghost ? ghostMat : new THREE.MeshStandardMaterial({ color, roughness: rough, emissive, side: THREE.DoubleSide });
  const eyeMat = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  const add = (geo, mat, x, y, z, parent = grp) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !ghost; parent.add(m); return m; };
  if (type === 'wraith') {
    parts.cloak = add(G('Cylinder', 0.26, 0.78, 2.1, 14, 1, true), M(0x0b0c10), 0, 1.05, 0);
    parts.torso = add(G('Sphere', 0.34, 12, 10), M(0x0e0f14), 0, 2.0, 0); parts.torso.scale.set(1.2, 0.8, 0.8);
    parts.head = add(G('Sphere', 0.22, 14, 12), M(0xc9ccc2, 0.7), 0, 2.28, -0.06); parts.head.scale.set(0.9, 1.15, 0.95);
    add(G('Sphere', 0.06, 8, 6), M(0x050505), -0.08, 2.3, -0.2); add(G('Sphere', 0.06, 8, 6), M(0x050505), 0.08, 2.3, -0.2);
    add(G('Box', 0.1, 0.06, 0.05), M(0x050505), 0, 2.17, -0.2);
    parts.eyeL = add(G('Sphere', 0.035, 8, 6), eyeMat(0xff2418), -0.08, 2.3, -0.235); parts.eyeR = add(G('Sphere', 0.035, 8, 6), eyeMat(0xff2418), 0.08, 2.3, -0.235);
    parts.arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.45, 1.95, -0.05); grp.add(a); add(G('Cylinder', 0.04, 0.03, 1.5, 6), M(0x7e8a88, 0.6), 0, -0.7, 0, a).rotation.x = 0; for (let k = -1; k <= 1; k++) { const f = add(G('Cone', 0.018, 0.28, 5), M(0x8b9694, 0.6), k * 0.05, -1.5, 0, a); f.rotation.z = k * 0.2; } return a; });
  } else if (type === 'crawler') {
    parts.body = add(G('Sphere', 0.5, 12, 10), M(0x2f2722), 0, 0.5, 0.15); parts.body.scale.set(0.95, 0.6, 1.25);
    parts.head = add(G('Sphere', 0.3, 10, 8), M(0x4d3d33), 0, 0.5, -0.65); parts.head.scale.set(1, 0.85, 1.05);
    [[-0.1, -0.88], [0.1, -0.88], [-0.17, -0.8], [0.17, -0.8]].forEach(([x, z], i) => { parts['eye' + i] = add(G('Sphere', 0.035, 8, 6), eyeMat(0xff2418), x, 0.56, z); });
    add(G('Cone', 0.03, 0.2, 5), M(0xd8c9b0), -0.1, 0.4, -0.9).rotation.x = -Math.PI / 2; add(G('Cone', 0.03, 0.2, 5), M(0xd8c9b0), 0.1, 0.4, -0.9).rotation.x = -Math.PI / 2;
    parts.legs = []; for (let i = 0; i < 8; i++) { const side = i < 4 ? -1 : 1, idx = i % 4; const l = new THREE.Group(); l.position.set(side * 0.4, 0.5, -0.35 + idx * 0.32); grp.add(l); const up = add(G('Cylinder', 0.035, 0.03, 0.75, 5), M(0x241d19), side * 0.35, 0.1, 0, l); up.rotation.z = side * 1.0; add(G('Cylinder', 0.028, 0.012, 0.8, 5), M(0x241d19), side * 0.78, -0.25, 0, l).rotation.z = side * -0.3; parts.legs.push({ g: l, side, idx }); }
  } else if (type === 'stalker') {
    parts.body = add(G('Capsule', 0.26, 1.2, 4, 10), M(0xd4d6cd, 0.55, 0x15150f), 0, 1.35, 0); parts.body.scale.set(1.05, 1, 0.8);
    parts.head = add(G('Sphere', 0.25, 14, 12), M(0xe8eae2, 0.5, 0x1a1a14), 0, 2.4, -0.04); parts.head.scale.set(0.85, 1.2, 0.9);
    parts.arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.36, 2.0, 0); grp.add(a); add(G('Cylinder', 0.045, 0.035, 2.1, 6), M(0xc9cbc2, 0.55), 0, -1.0, 0, a); add(G('Sphere', 0.07, 6, 6), M(0xe0e2da), 0, -2.08, 0, a); return a; });
  } else { // howler
    parts.body = add(G('Cylinder', 0.28, 0.42, 2.7, 10), M(0x1b1a20), 0, 1.35, 0);
    parts.head = add(G('Sphere', 0.34, 12, 10), M(0x8c8a84, 0.7), 0, 2.85, -0.08); parts.head.scale.set(0.9, 1.15, 0.9);
    parts.mouth = add(G('Circle', 0.17, 14), new THREE.MeshBasicMaterial({ color: 0x020202, side: THREE.DoubleSide }), 0, 2.72, -0.34);
    parts.eyeL = add(G('Sphere', 0.03, 6, 6), eyeMat(0xff2418), -0.12, 2.95, -0.3); parts.eyeR = add(G('Sphere', 0.03, 6, 6), eyeMat(0xff2418), 0.12, 2.95, -0.3);
    parts.arms = [-1, 1].map((s) => { const a = new THREE.Group(); a.position.set(s * 0.34, 2.4, 0); grp.add(a); add(G('Cylinder', 0.04, 0.03, 1.3, 6), M(0x4b4b52), 0, 0.55, 0, a); return a; });
  }
  return { group: grp, parts, ghostMat };
}

/* ───────────── view ───────────── */
export async function createView(game) {
  const canvas = document.getElementById('stage3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x020304, 1);
  const tx = makeTextures(renderer);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x020304, 0.05); scene.background = new THREE.Color(0x020304);
  const camera = new THREE.PerspectiveCamera(76, 16 / 9, 0.08, 90); camera.rotation.order = 'YXZ'; scene.add(camera);

  // viewmodel: torch + forearm, lit only by the world
  const vm = new THREE.Group(); vm.position.set(0.36, -0.34, -0.66); camera.add(vm);
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.052, 0.3, 12), new THREE.MeshBasicMaterial({ color: 0x15191b, fog: false })); torch.rotation.x = Math.PI / 2; vm.add(torch);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c4, fog: false })); lens.position.z = -0.151; lens.rotation.y = Math.PI; vm.add(lens);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshBasicMaterial({ color: 0x10161b, fog: false })); arm.position.set(0.04, -0.05, 0.3); arm.rotation.x = -0.25; vm.add(arm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5a4a40, fog: false })); hand.position.set(0, -0.015, 0.02); vm.add(hand);
  // faint volumetric beam in the dust
  const beamH = 24, beamR = Math.tan(0.5) * beamH;
  const beamGeo = new THREE.ConeGeometry(beamR, beamH, 28, 1, true); beamGeo.translate(0, -beamH / 2, 0); beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false, uniforms: { uInt: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uInt; varying vec3 vP; void main(){ float d = -vP.z; float a = smoothstep(0.8, 5.0, d) * pow(clamp(1.0 - d/24.0, 0.0, 1.0), 1.6); gl_FragColor = vec4(vec3(1.0,0.86,0.6) * a * uInt, a * uInt); }' });
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.frustumCulled = false; beam.position.set(0.34, -0.3, -0.8); camera.add(beam);

  // fixed light pool
  const ambient = new THREE.AmbientLight(0x1b2430, 0.55); scene.add(ambient);
  const near = new THREE.PointLight(0xffb27a, 3.2, 10, 2); scene.add(near);
  const spot = new THREE.SpotLight(0xffe2b0, 520, 44, 0.5, 0.85, 1.5); spot.castShadow = true; scene.add(spot, spot.target);
  let pool = [];
  const rebuildPool = (n) => { pool.forEach((l) => scene.remove(l)); pool = []; for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xcfe8b8, 0, 15, 2); scene.add(l); pool.push(l); } };

  // post pass
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 1 }, uGrain: { value: 0.07 }, uSan: { value: 1 }, uDmg: { value: 0 }, uHide: { value: 0 }, uChroma: { value: 0 }, uFade: { value: 0 }, uGlitch: { value: 0 }, uBright: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig,uGrain,uSan,uDmg,uHide,uChroma,uFade,uGlitch,uBright; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 uv = vUv; vec2 c = uv - 0.5;
        float tt = floor(uTime * 18.0);
        float band = floor(uv.y * 38.0);
        if (uGlitch > 0.02 && hash(vec2(band, tt)) > 1.0 - uGlitch * 0.45) uv.x += (hash(vec2(band, tt + 7.0)) - 0.5) * 0.09 * uGlitch;
        float ca = uChroma * 0.007 * (0.25 + dot(c, c) * 5.0);
        vec3 col = vec3(texture2D(tDiffuse, uv + c * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ca).b);
        col *= uBright;
        col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
        col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
        float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSan);
        float d = length(c * vec2(1.0, 0.86));
        col *= mix(1.0, smoothstep(0.82, 0.2, d), uVig);
        col = mix(col, vec3(0.5, 0.02, 0.03), smoothstep(0.18, 0.78, d) * uDmg * 0.75);
        float bar = uHide * 0.3; col *= 1.0 - uHide * (smoothstep(1.0 - bar - 0.01, 1.0 - bar + 0.01, uv.y) + smoothstep(bar + 0.01, bar - 0.01, uv.y));
        col *= 1.0 - uHide * 0.45 * smoothstep(0.28, 0.5, abs(fract(uv.y * 38.0) - 0.5));
        col += uHide * vec3(0.012, 0.014, 0.016);
        col += (hash(uv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain;
        gl_FragColor = vec4(col * (1.0 - uFade), 1.0);
      }` });
  const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  let rt = null;

  // per-level state
  let levelGroup = null, entMap = new Map(), pickMap = new Map(), fuseMap = new Map(), flareMap = new Map(), ghostMap = new Map();
  let lampMeshes = [], exitGrp = null, lockerInst = null, lockerIndex = new Map(), hiddenKey = -1, lockerMats = [];
  let dust = null, dustPos = null, dustCol = null, dustVel = null;
  let curQ = 'medium', w = 1, h = 1, lastLevel = null, nGlow = 0;

  const glowSprite = (color, size, opacity) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx.glow, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity })); s.scale.set(size, size, 1); return s; };

  function disposeLevel() {
    if (!levelGroup) return;
    scene.remove(levelGroup);
    levelGroup.traverse((o) => { disp(o); if (o.userData.ownMat) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } });
    levelGroup = null;
    for (const m of [entMap, pickMap, fuseMap, flareMap, ghostMap]) { for (const v of m.values()) { if (v.group) { scene.remove(v.group); v.group.traverse((o) => { disp(o); }); } if (v.ghostMat) v.ghostMat.dispose(); } m.clear(); }
    if (dust) { dust.geometry.dispose(); dust.material.dispose(); dust = null; }
    lampMeshes = []; lockerIndex = new Map(); hiddenKey = -1;
  }

  function quadBucket() { return { p: [], n: [], u: [], i: [] }; }
  function pushQuad(b, a, bb, c, d, nrm) { const o = b.p.length / 3; b.p.push(...a, ...bb, ...c, ...d); for (let k = 0; k < 4; k++) b.n.push(...nrm); b.u.push(0, 0, 1, 0, 1, 1, 0, 1); b.i.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  function bucketMesh(b, mat, cast, receive) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2)); g.setIndex(b.i);
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
  }
  const stdMat = (map, rough = 0.9, bump = 0.7) => { const m = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: bump, roughness: rough, metalness: 0 }); return m; };
  const floorMats = tx.floors.map((arr) => arr.map((t) => stdMat(t, 0.8, 1.2)));
  const wallMats = tx.walls.map((t) => stdMat(t, 0.9, 1.4));
  const ceilMat = stdMat(tx.ceil, 0.95, 0.8);

  function loadLevel(L) {
    disposeLevel(); lastLevel = L;
    const g = levelGroup = new THREE.Group(); scene.add(g);
    const W = L.w, fb = new Map(), wb = [0, 1, 2, 3].map(quadBucket), cb = quadBucket();
    const hashv = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
    for (let ty = 0; ty < W; ty++) for (let tx_ = 0; tx_ < W; tx_++) {
      const i = ty * W + tx_, t = L.tiles[i]; if (t === 0) continue;
      const x0 = tx_ * TILE, x1 = x0 + TILE, z0 = ty * TILE, z1 = z0 + TILE, room = L.roomAt[i], kind = room >= 0 ? L.rooms[room].kind : 4, v = hashv(tx_, ty) & 3, key = kind * 4 + v;
      if (!fb.has(key)) fb.set(key, quadBucket());
      pushQuad(fb.get(key), [x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [0, 1, 0]);
      // uv: (0,0)(1,0)(1,1)(0,1) maps a->b->c->d; floor winding a,b,c,d fine
      pushQuad(cb, [x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], [0, -1, 0]);
      const wv = hashv(tx_ + 7, ty + 3) & 3, B = wb[wv];
      if (tx_ > 0 && L.tiles[i - 1] === 0) pushQuad(B, [x0, 0, z1], [x0, 0, z0], [x0, WALL_H, z0], [x0, WALL_H, z1], [1, 0, 0]);
      if (tx_ < W - 1 && L.tiles[i + 1] === 0) pushQuad(B, [x1, 0, z0], [x1, 0, z1], [x1, WALL_H, z1], [x1, WALL_H, z0], [-1, 0, 0]);
      if (ty > 0 && L.tiles[i - W] === 0) pushQuad(B, [x0, 0, z0], [x1, 0, z0], [x1, WALL_H, z0], [x0, WALL_H, z0], [0, 0, 1]);
      if (ty < W - 1 && L.tiles[i + W] === 0) pushQuad(B, [x1, 0, z1], [x0, 0, z1], [x0, WALL_H, z1], [x1, WALL_H, z1], [0, 0, -1]);
    }
    for (const [key, b] of fb) g.add(bucketMesh(b, floorMats[key >> 2][key & 3], false, true));
    g.add(bucketMesh(cb, ceilMat, false, false));
    wb.forEach((b, v) => { if (b.p.length) g.add(bucketMesh(b, wallMats[v], true, true)); });

    // props (instanced)
    const kinds = [{ geo: new THREE.BoxGeometry(2.3, 1.7, 2.3), map: tx.crate, y: 0.85 }, { geo: new THREE.BoxGeometry(1.35, 3.0, 2.2), map: tx.locker, y: 1.5 }, { geo: new THREE.BoxGeometry(2.1, 0.95, 2.6), map: tx.bed, y: 0.55 }];
    const lists = [[], [], []];
    for (let i = 0; i < W * W; i++) if (L.tiles[i] === 2) lists[L.propKind[i]].push(i);
    kinds.forEach((k, ki) => {
      if (!lists[ki].length) return;
      const mat = new THREE.MeshStandardMaterial({ map: k.map, roughness: ki === 1 ? 0.5 : 0.9, metalness: ki === 1 ? 0.5 : 0 }); mat.userData = {};
      const inst = new THREE.InstancedMesh(k.geo, mat, lists[ki].length); inst.castShadow = true; inst.receiveShadow = true; inst.userData.ownMat = true;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
      lists[ki].forEach((i, n) => { const x = i % W, y = (i / W) | 0; e.set(0, (hashv(x, y) & 3) * Math.PI / 2, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3((x + 0.5) * TILE, k.y, (y + 0.5) * TILE), q, s); inst.setMatrixAt(n, m4); if (ki === 1) lockerIndex.set(i, { n, m: m4.clone() }); });
      g.add(inst); if (ki === 1) lockerInst = inst;
    });

    // ceiling lamps
    L.lamps.forEach((m) => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xd6f0c4, emissiveIntensity: 1, roughness: 0.5 });
      const fx = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.5), mat); fx.position.set(m.x * K, WALL_H - 0.06, m.y * K); fx.userData.ownMat = true; g.add(fx);
      const sp = glowSprite(0xcfe8b8, 5, 0.4); sp.position.set(m.x * K, WALL_H - 0.5, m.y * K); g.add(sp);
      lampMeshes.push({ m, mat, sp });
    });

    // exit: free-standing doorway with a lit pane and sign
    exitGrp = new THREE.Group(); exitGrp.position.set(L.exit.x * K, 0, L.exit.y * K); g.add(exitGrp);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x23292b, roughness: 0.6, metalness: 0.5 });
    const post = (x) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.1, 0.5), frameMat); p.position.set(x, 1.55, 0); p.castShadow = true; exitGrp.add(p); };
    post(-1.15); post(1.15); const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.28, 0.5), frameMat); lintel.position.y = 3.05; exitGrp.add(lintel);
    exitGrp.userData.paneMat = new THREE.MeshBasicMaterial({ color: 0x401014, side: THREE.DoubleSide, fog: false }); const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.8), exitGrp.userData.paneMat); pane.position.y = 1.4; exitGrp.add(pane);
    exitGrp.userData.signMat = new THREE.MeshBasicMaterial({ map: tx.exitSign, color: 0x992020, side: THREE.DoubleSide, fog: false }); const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), exitGrp.userData.signMat); sign.position.set(0, 2.55, 0.01); exitGrp.add(sign);
    exitGrp.userData.glow = glowSprite(0xff2828, 9, 0.5); exitGrp.userData.glow.position.set(0, 1.5, 0.4); exitGrp.add(exitGrp.userData.glow);
    exitGrp.userData.signMat.userData = {}; exitGrp.userData.ownMats = [frameMat, exitGrp.userData.paneMat, exitGrp.userData.signMat];

    prewarmIfNeeded();
    // dust motes
    const N = 320; dustPos = new Float32Array(N * 3); dustCol = new Float32Array(N * 3); dustVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { dustPos[i * 3] = camera.position.x + (Math.random() - 0.5) * 24; dustPos[i * 3 + 1] = Math.random() * WALL_H; dustPos[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * 24; dustVel[i * 3] = (Math.random() - 0.5) * 0.15; dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.08; dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.15; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); dg.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.09, map: tx.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false })); dust.frustumCulled = false; g.add(dust);
  }

  /* entity factories */
  function pickupMesh(kind) {
    const grp = new THREE.Group(), M = (c, e = 0x111111) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: e });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m; };
    if (kind === 'battery') { const b = add(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 12), M(0x2a2c2e), 0, 0, 0); b.rotation.z = Math.PI / 2; const band = add(new THREE.CylinderGeometry(0.175, 0.175, 0.28, 12), M(0xe8b83a, 0x3a2a08), 0, 0, 0); band.rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), M(0x999999), 0.34, 0, 0).rotation.z = Math.PI / 2; }
    else if (kind === 'medkit') { add(new THREE.BoxGeometry(0.75, 0.42, 0.55), M(0xe6e2d6, 0x15140f), 0, 0, 0); add(new THREE.BoxGeometry(0.1, 0.02, 0.36), M(0xb3202a, 0x400808), 0, 0.22, 0); add(new THREE.BoxGeometry(0.36, 0.02, 0.1), M(0xb3202a, 0x400808), 0, 0.22, 0); }
    else if (kind === 'pills') { add(new THREE.CylinderGeometry(0.17, 0.17, 0.46, 12), M(0xd98b2b, 0x2a1804), 0, 0, 0); add(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12), M(0xf2efe4, 0x151514), 0, 0.27, 0); }
    else if (kind === 'flare') { const f = add(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8), M(0xb3202a, 0x400808), 0, 0, 0); f.rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(0.075, 0.075, 0.18, 8), M(0x161616), -0.5, 0, 0).rotation.z = Math.PI / 2; }
    else { add(new THREE.BoxGeometry(0.55, 0.02, 0.75), new THREE.MeshStandardMaterial({ map: tx.paper, roughness: 0.9, emissive: 0x2a2820 }), 0, 0, 0); }
    return { group: grp };
  }
  function fuseMesh() {
    const grp = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), new THREE.MeshStandardMaterial({ color: 0xc9a24a, emissive: 0x8a5a10, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.5 })); grp.add(body);
    [-0.38, 0.38].forEach((y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x6b5420, roughness: 0.5, metalness: 0.6 })); c.position.y = y; grp.add(c); });
    const gl = glowSprite(0xffb050, 3.2, 0.55); grp.add(gl); return { group: grp, glow: gl };
  }
  function flareMesh() {
    const grp = new THREE.Group(), st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xb3202a, emissive: 0x802010, roughness: 0.6 })); st.rotation.z = Math.PI / 2; grp.add(st);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false })); tip.position.x = 0.42; grp.add(tip);
    const gl = glowSprite(0xff7a30, 6, 0.85); gl.position.x = 0.42; grp.add(gl); return { group: grp, glow: gl };
  }

  /** Build one of everything off-screen and compile it, so shaders never compile in the middle of play. */
  function prewarm() {
    // objects must sit inside the flashlight's shadow frustum too, or the shadow-pass (depth) shader variants never compile
    camera.position.set(0, 1.6, 0); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld(true);
    spot.position.set(0, 1.6, 0); spot.target.position.set(0, 1.6, -10); spot.target.updateMatrixWorld(); spot.intensity = 1;
    const warm = new THREE.Group(); warm.position.set(0, 0, -6); scene.add(warm);
    warm.children.length = 0;
    [['wraith', -1.5], ['crawler', -0.5], ['stalker', 0.5], ['howler', 1.5]].forEach(([t, x]) => { const g = buildEnemy(t, false).group; g.position.x = x; warm.add(g); });
    const gh = buildEnemy('wraith', true); warm.add(gh.group);
    for (const k of ['battery', 'medkit', 'pills', 'flare', 'note']) warm.add(pickupMesh(k).group);
    warm.add(fuseMesh().group); warm.add(flareMesh().group);
    renderer.compile(scene, camera);
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
    scene.remove(warm);
    warm.traverse((o) => { disp(o); }); gh.ghostMat.dispose();
  }
  const v3 = new THREE.Vector3(), fwd = new THREE.Vector3();

  function setSize(cw, ch) {
    const q = QUALITY[curQ], dpr = Math.min(window.devicePixelRatio || 1, q.dprCap);
    w = Math.max(2, Math.floor(cw * dpr * q.scale)); h = Math.max(2, Math.floor(ch * dpr * q.scale));
    renderer.setPixelRatio(1); renderer.setSize(Math.floor(cw * dpr), Math.floor(ch * dpr), false);
    camera.aspect = cw / ch; camera.updateProjectionMatrix();
    if (rt) rt.dispose();
    const opts = { type: THREE.HalfFloatType, depthBuffer: true, samples: q.msaa };
    try { rt = new THREE.WebGLRenderTarget(w, h, opts); } catch (e) { rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true }); }
    postMat.uniforms.uRes.value.set(w, h);
  }
  function setQuality(q) {
    curQ = QUALITY[q] ? q : 'medium'; const Q = QUALITY[curQ];
    renderer.shadowMap.enabled = Q.shadow > 0; spot.castShadow = Q.shadow > 0;
    if (Q.shadow) { spot.shadow.mapSize.set(Q.shadow, Q.shadow); if (spot.shadow.map) { spot.shadow.map.dispose(); spot.shadow.map = null; } spot.shadow.camera.near = 0.15; spot.shadow.camera.far = 44; spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.04; }
    rebuildPool(Q.pool); setSize(window.innerWidth, window.innerHeight);
  }
  setQuality(game.qOverride || game.settings.quality);

  function updateEntities(t, P, L) {
    // monsters
    const alive = new Set();
    for (const e of game.enemies) {
      alive.add(e); let en = entMap.get(e);
      if (!en) { en = buildEnemy(e.type, false); en.group.traverse((o) => { if (o.isMesh) o.userData.own = true; }); scene.add(en.group); entMap.set(e, en); }
      en.group.position.set(e.x * K, 0, e.y * K); en.group.rotation.y = -e.angle - Math.PI / 2;
      const chase = e.state === 'chase', sp = Math.hypot(e.vx || 0, e.vy || 0) / 60, ph = t * (3 + sp * 4) + e.t;
      const p = en.parts;
      if (e.type === 'wraith') {
        p.cloak.scale.set(1 + Math.sin(ph * 0.7) * 0.04, 1, 1 + Math.cos(ph * 0.6) * 0.04); en.group.position.y = Math.sin(ph * 0.5) * 0.06;
        p.arms.forEach((a, i) => { a.rotation.x = (chase ? -1.25 : -0.25) + Math.sin(ph + i * 2) * 0.12; a.rotation.z = (i ? -1 : 1) * (chase ? 0.1 : 0.22); });
        const k = chase ? 1 : 0.35; p.eyeL.material.color.setRGB(k, 0.1 * k, 0.07 * k); p.eyeR.material.color.copy(p.eyeL.material.color);
      } else if (e.type === 'crawler') {
        p.legs.forEach((l) => { l.g.rotation.y = Math.sin(ph * 1.6 + l.idx * 1.3 + (l.side > 0 ? 1.5 : 0)) * 0.35; l.g.rotation.z = Math.abs(Math.sin(ph * 1.6 + l.idx)) * 0.1; });
        p.body.position.y = 0.5 + Math.abs(Math.sin(ph * 1.6)) * 0.04;
        const k = chase ? 1 : 0.3; for (let i = 0; i < 4; i++) p['eye' + i].material.color.setRGB(k, 0.09 * k, 0.06 * k);
      } else if (e.type === 'stalker') {
        p.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.12 + Math.sin(t * 1.3 + i) * 0.03); a.rotation.x = Math.sin(t * 0.9 + i) * 0.05; }); p.head.rotation.z = Math.sin(t * 0.7) * 0.08;
      } else { // howler
        const open = e.shriekCd > 8 ? 2.8 : 1 + Math.sin(t * 2) * 0.1; p.mouth.scale.set(1, open, 1); p.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (e.shriekCd > 8 ? 0.35 : 0.9); });
        const k = e.shriekCd > 8 ? 1 : 0.4; p.eyeL.material.color.setRGB(k, 0.1 * k, 0.07 * k); p.eyeR.material.color.copy(p.eyeL.material.color);
      }
    }
    for (const [e, en] of entMap) if (!alive.has(e)) { scene.remove(en.group); en.group.traverse((o) => { dispMats(o); }); entMap.delete(e); }
    // hallucinations
    const ha = new Set();
    for (const hh of game.halluc) { ha.add(hh); let en = ghostMap.get(hh); if (!en) { en = buildEnemy(hh.type, true); scene.add(en.group); ghostMap.set(hh, en); } en.group.position.set(hh.x * K, 0, hh.y * K); en.group.rotation.y = -hh.angle - Math.PI / 2; en.ghostMat.opacity = clamp(hh.life, 0, 0.5) * 0.8; }
    for (const [hh, en] of ghostMap) if (!ha.has(hh)) { scene.remove(en.group); en.ghostMat.dispose(); ghostMap.delete(hh); }
    // pickups
    const pa = new Set();
    for (const k of game.pickups) { pa.add(k); let pm = pickMap.get(k); if (!pm) { pm = pickupMesh(k.kind); scene.add(pm.group); pickMap.set(k, pm); } pm.group.position.set(k.x * K, (k.kind === 'battery' ? 0.19 : k.kind === 'flare' ? 0.1 : k.kind === 'note' ? 0.03 : 0.25) + Math.sin(k.t * 2.2) * 0.04, k.y * K); pm.group.rotation.y = k.t * 0.8; }
    for (const [k, pm] of pickMap) if (!pa.has(k)) { scene.remove(pm.group); pm.group.traverse((o) => { disp(o); }); pickMap.delete(k); }
    // fuses
    const fa = new Set();
    for (const f of game.fuses) { if (f.got) continue; fa.add(f); let fm = fuseMap.get(f); if (!fm) { fm = fuseMesh(); scene.add(fm.group); fuseMap.set(f, fm); } fm.group.position.set(f.x * K, 1.0 + Math.sin(f.t * 2.2) * 0.12, f.y * K); fm.group.rotation.y = f.t * 1.4; fm.glow.material.opacity = 0.45 + Math.sin(f.t * 3) * 0.12; }
    for (const [f, fm] of fuseMap) if (!fa.has(f)) { scene.remove(fm.group); fm.group.traverse((o) => { disp(o); }); fuseMap.delete(f); }
    // thrown flares
    const la = new Set();
    for (const f of game.flares) { la.add(f); let fm = flareMap.get(f); if (!fm) { fm = flareMesh(); scene.add(fm.group); flareMap.set(f, fm); } const sp = Math.hypot(f.vx, f.vy); fm.group.position.set(f.x * K, 0.1 + Math.min(1.2, sp / 220), f.y * K); fm.group.rotation.y = f.seed; fm.glow.material.opacity = 0.6 + Math.random() * 0.3; }
    for (const [f, fm] of flareMap) if (!la.has(f)) { scene.remove(fm.group); fm.group.traverse((o) => { disp(o); }); flareMap.delete(f); }
    // exit state
    const powered = game.fuseGot >= game.fuseNeed && !game.attract;
    if (exitGrp) { const u = exitGrp.userData; u.paneMat.color.setHex(powered ? 0x1f7a44 : 0x401014); u.signMat.color.setHex(powered ? 0x5cff9a : 0x992020); u.glow.material.color.setHex(powered ? 0x40ff90 : 0xff2828); u.glow.material.opacity = (powered ? 0.55 : 0.3) * (0.85 + Math.sin(t * 2.5) * 0.15); }
    // lamps
    for (const lm of lampMeshes) { lm.mat.emissiveIntensity = 0.15 + lm.m.on * 1.6; lm.sp.material.opacity = 0.05 + 0.4 * lm.m.on; }
    // hide the locker we are standing in
    const hk = P.hidden && P.hideTile ? P.hideTile.ty * L.w + P.hideTile.tx : -1;
    if (hk !== hiddenKey && lockerInst) {
      const m4 = new THREE.Matrix4(); if (hiddenKey >= 0 && lockerIndex.has(hiddenKey)) { const r = lockerIndex.get(hiddenKey); lockerInst.setMatrixAt(r.n, r.m); }
      if (hk >= 0 && lockerIndex.has(hk)) { const r = lockerIndex.get(hk); m4.copy(r.m).scale(new THREE.Vector3(0.001, 0.001, 0.001)); m4.setPosition(r.m.elements[12], -50, r.m.elements[14]); lockerInst.setMatrixAt(r.n, m4); }
      lockerInst.instanceMatrix.needsUpdate = true; hiddenKey = hk;
    }
  }

  function updateLights(t, P, L, lampOn) {
    const cx = camera.position.x, cz = camera.position.z;
    // flashlight
    const flick = 1 - (game.settings.shake ? Math.random() * 0.05 : 0);
    camera.updateMatrixWorld(true);
    v3.set(0.3, -0.26, -0.5).applyMatrix4(camera.matrixWorld); spot.position.copy(v3);
    camera.getWorldDirection(fwd); spot.target.position.copy(spot.position).addScaledVector(fwd, 10); spot.target.updateMatrixWorld();
    spot.intensity = lampOn ? 520 * flick : 0; lens.visible = lampOn; beamMat.uniforms.uInt.value = lampOn ? 0.55 : 0;
    near.position.set(cx, EYE, cz); near.intensity = P.hidden ? 1.4 : (lampOn ? 3 : 1.8);
    // pool: flares first, then nearest lamps that can plausibly light the player
    const cand = [];
    for (const f of game.flares) cand.push({ x: f.x * K, y: 0.5, z: f.y * K, c: 0xff7a3a, i: (70 + Math.random() * 18) * Math.min(1, f.life / 2), d: Math.hypot(f.x * K - cx, f.y * K - cz) - 100 });
    for (const m of L.lamps) { if (m.on < 0.12) continue; const d = Math.hypot(m.x * K - cx, m.y * K - cz); if (d > 34) continue; if (d > 9 && !L.los(m.x, m.y, game.player.x, game.player.y)) continue; cand.push({ x: m.x * K, y: WALL_H - 0.5, z: m.y * K, c: 0xcfe8b8, i: 60 * m.on, d }); }
    cand.sort((a, b) => a.d - b.d);
    pool.forEach((l, i) => { const c = cand[i]; if (c) { l.position.set(c.x, c.y, c.z); l.color.setHex(c.c); l.intensity = c.i; } else l.intensity = 0; });
  }

  function updateDust(dt, P, lampOn) {
    if (!dust) return;
    const cx = camera.position.x, cz = camera.position.z, n = dustPos.length / 3;
    for (let i = 0; i < n; i++) {
      const j = i * 3; dustPos[j] += dustVel[j] * dt; dustPos[j + 1] += dustVel[j + 1] * dt; dustPos[j + 2] += dustVel[j + 2] * dt;
      if (dustPos[j] - cx > 14) dustPos[j] -= 28; else if (dustPos[j] - cx < -14) dustPos[j] += 28; if (dustPos[j + 2] - cz > 14) dustPos[j + 2] -= 28; else if (dustPos[j + 2] - cz < -14) dustPos[j + 2] += 28;
      if (dustPos[j + 1] < 0.1) dustPos[j + 1] = WALL_H - 0.1; if (dustPos[j + 1] > WALL_H) dustPos[j + 1] = 0.2;
      let b = 0.04;
      const dx = dustPos[j] - camera.position.x, dy = dustPos[j + 1] - camera.position.y, dz = dustPos[j + 2] - camera.position.z, d = Math.hypot(dx, dy, dz) || 1;
      if (d < 2.2) b = 0;
      else if (lampOn) { const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d; if (dot > 0.88 && d < 26) b = 0.5 * (1 - d / 26) * clamp((dot - 0.88) / 0.08, 0, 1); }
      dustCol[j] = dustCol[j + 1] = dustCol[j + 2] = b;
    }
    dust.geometry.attributes.position.needsUpdate = true; dust.geometry.attributes.color.needsUpdate = true;
  }

  let warmed = false; const prewarmIfNeeded = () => { if (!warmed) { warmed = true; prewarm(); } };
  let lastT = 0;
  function render() {
    const P = game.player, L = game.level; if (!L) return;
    const t = game.time, dt = Math.min(0.05, Math.max(0.001, t - lastT)); lastT = t;
    const S = game.settings;
    // camera
    const moving = Math.hypot(P.vx, P.vy) > 20, bob = moving ? Math.sin(P.bob * 2.2) * (P.sprint ? 0.07 : 0.04) : Math.sin(t * 1.4) * 0.006;
    let y = EYE + bob - (P.hidden ? 0.05 : 0) , roll = 0, pitch = P.pitch || 0;
    if (game.state === 'dead') { const k = clamp(game.deadT / 1.2, 0, 1); y = EYE * (1 - 0.75 * k); roll = 0.9 * k; pitch = lerp(pitch, -0.3, k); }
    const sh = S.shake ? game.cam.shake * 0.0035 : 0;
    camera.position.set(P.x * K, y, P.y * K);
    camera.rotation.set(pitch + (Math.random() - 0.5) * sh, -P.angle - Math.PI / 2 + (Math.random() - 0.5) * sh, roll + (moving ? Math.sin(P.bob * 1.1) * 0.006 : 0), 'YXZ');
    // viewmodel sway
    vm.position.set(0.36 + Math.sin(P.bob * 1.1) * (moving ? 0.01 : 0), -0.34 + (moving ? Math.abs(Math.sin(P.bob * 2.2)) * 0.012 : 0) + (P.hidden ? -0.5 : 0), -0.66);
    vm.visible = !P.hidden;
    const lampOn = P.lightOn && P.battery > 0 && P.flicker <= 0 && !P.hidden;
    updateLights(t, P, L, lampOn); updateEntities(t, P, L); updateDust(dt, P, lampOn);
    // fog density tightens with low sanity
    scene.fog.density = 0.05 + (1 - P.sanity / 100) * 0.022;
    ambient.intensity = 0.55 * (S.brightness !== undefined ? 1 - (S.brightness - 50) / 50 * 0.4 : 1);
    // post uniforms
    const u = postMat.uniforms, san = P.sanity / 100;
    const lowHp = P.hp < 40 ? (40 - P.hp) / 40 : 0, pulse = 0.5 + 0.5 * Math.sin(t * (3 + lowHp * 3));
    u.uTime.value = t; u.uSan.value = san < 0.7 ? 0.35 + (san / 0.7) * 0.65 : 1; u.uDmg.value = Math.max(game.damageFlash * 0.9, lowHp * 0.5 * pulse);
    u.uHide.value = P.hideK || 0; u.uGlitch.value = S.shake ? Math.min(1, game.glitch || 0) : 0; u.uChroma.value = (S.shake ? (game.glitch || 0) * 1.4 : 0) + (1 - san) * 0.8 + game.damageFlash * 1.2;
    u.uFade.value = Math.max(clamp(game.fade, 0, 1), game.state === 'dead' ? clamp(game.deadT / 1.8, 0, 0.8) : 0); u.uBright.value = 1 - ((S.brightness || 50) - 50) / 50 * 0.3; u.uGrain.value = 0.06 + (1 - san) * 0.07; u.uVig.value = 0.9 + (1 - san) * 0.1;
    renderer.info.reset();
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); u.tDiffuse.value = rt.texture; renderer.render(postScene, postCam);
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  return {
    canvas, loadLevel, render, setQuality, resize: () => setSize(window.innerWidth, window.innerHeight),
    info: () => ({ programs: renderer.info.programs ? renderer.info.programs.length : -1, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    debug: () => { const ids = new Set(); let meshes = 0; scene.traverse((o) => { if (o.geometry) { ids.add(o.geometry.uuid); meshes++; } }); return { sceneGeoms: ids.size, meshes, ent: entMap.size, pick: pickMap.size, fuse: fuseMap.size, flare: flareMap.size, ghost: ghostMap.size, children: scene.children.length }; },
    renderer, scene, camera, THREE,
    dispose() { disposeLevel(); renderer.dispose(); },
  };
}
