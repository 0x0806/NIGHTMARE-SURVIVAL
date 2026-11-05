/* Nightmare Survival — top-down flashlight horror.
 * Single-file, dependency-free. Systems: seeded level generator, grid raycast lighting,
 * enemy AI with flow-field pathing, procedural Web Audio, local leaderboards.
 * Developed by 0x0806. */
'use strict';
(() => {

/* ───────────────────────────── utilities ───────────────────────────── */
const TS = 48;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const lerpAngle = (a, b, t) => a + angDiff(b, a) * t;
const $ = (id) => document.getElementById(id);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('nightmare.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nightmare.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
const fmtTime = (s) => {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
};
const fmtTimeMs = (s) => fmtTime(s) + '.' + String(Math.floor((s % 1) * 100)).padStart(2, '0');

const WARD_NAMES = ['The Intake Ward', 'Boiler Room', 'The Morgue', 'Ward of Whispers', 'Quarantine Wing', 'The Chapel',
  'Surgical Theatre', 'The Drowned Cellar', 'Isolation Block', 'Records Archive', 'The Long Corridor', 'Electroshock Wing',
  'The Nursery', 'Pathology', 'The Last Ward'];
const wardName = (n, mode) => (mode === 'story' && STORY.wards[n] ? STORY.wards[n].title : WARD_NAMES[(n - 1) % WARD_NAMES.length]);
const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n] || String(n);
let _gl = null; function webglOk() { if (_gl === null) { try { const c = document.createElement('canvas'); _gl = !!c.getContext('webgl2'); } catch (e) { _gl = false; } } return _gl; }
const STORY = {
  intro: [
    'St. Aldric’s Sanatorium. 3:07 a.m.',
    'You are the night orderly. The generators have died, and every door in the building has locked itself.',
    'Then the intercom crackles, and a voice you know. Your sister, Wren. She is a patient in the Last Ward, seven floors down.',
    'The only way out is the freight lift, and it runs on fuses. Somebody has hidden them in every ward.',
    'Restore the fuses. Power the lift. Go down until you reach her.',
    'Whatever is on shift tonight hunts by sound and by light. Your torch is all you have.',
  ],
  wards: {
    1: { title: 'The Intake Ward', brief: 'Chapter I. Restore the fuses and take the lift down.', open: 'Ren? Oh, thank God. I can hear you walking. Use your torch, but not for long, the batteries are old. The fuses glow if you look for them.', mid: 'That’s one. The lift won’t move until you have them all.', done: 'The lift is moving. Keep coming. Please.' },
    2: { title: 'Boiler Room', brief: 'Chapter II. Something fast lives down here.', open: 'There’s something down here with me. It’s quick, and it hears everything. Fire frightens it. Throw a flare.', mid: 'Keep your head down. It hears you run.', done: 'Two floors. I can almost hear you breathing.' },
    3: { title: 'The Morgue', brief: 'Chapter III. Keep the pale one in your light.', open: 'The pale one lives in the morgue. It only moves when you’re not looking at it. The lamps keep it away. Stay in the light.', mid: 'Don’t look away from it. Don’t even blink.', done: 'You’re close. Do you remember this floor?' },
    4: { title: 'Ward of Whispers', brief: 'Chapter IV. If it gets close, hide.', open: 'If it gets close, hide in a locker and stay still. It will check. It always checks.', mid: 'Did you hear that? That wasn’t me.', done: 'Ren, why can’t I find your name on the staff list?' },
    5: { title: 'Quarantine Wing', brief: 'Chapter V. Something here screams.', open: 'There is something at the end of the hall that screams. Stay out of its sight. When it screams, everything comes.', mid: 'It knows how you move now. Change how you move.', done: 'Two more. I’ve been counting your steps.' },
    6: { title: 'The Chapel', brief: 'Chapter VI. Almost there.', open: 'They brought the ones who wouldn’t stop asking questions to the chapel. Keep going. Don’t read the walls.', mid: 'There’s a chart on my wall. It’s in your handwriting.', done: 'Almost there. Please don’t be angry with me.' },
    7: { title: 'The Last Ward', brief: 'Chapter VII. Everything is awake.', open: 'This is it. I’m just past the last door. Restore the lift and come to me. Everything is awake. Everything.', mid: 'Almost. Don’t turn around.', done: '…' },
  },
  alarm: 'The lift alarm is screaming. Everything just heard it. Hurry!',
  endings: {
    escape: { title: 'Ending: Patient 14', lines: [
      'The lift shudders to a stop. The Last Ward is a single room with a single bed.',
      'There is no one in it.',
      'On the wall hangs a chart. PATIENT 14. REN CALDER. ADMITTED THREE YEARS AGO.',
      'The intercom crackles one last time. “Welcome back, Ren. You were so close.”',
      'The doors open onto the street. Somewhere below, the lift is already going down again.',
    ] },
    truth: { title: 'Ending: The Way Out', lines: [
      'You have read every note the staff left behind. You know what the ward is.',
      'It was never hunting you. It was keeping you, because you asked it to. Wren is the one thing it could never give back.',
      'You tear the chart from the wall. The ward goes quiet, and for the first time the lights come on by themselves.',
      'Wren is waiting at the end of the corridor. Real. She takes your hand.',
      'The doors open onto a grey dawn.',
    ] },
  },
};
const NOTES = [
  'Patient 14 keeps asking who the man in the corner is. There is no one in the corner. Doubled his dose.',
  'Night shift report: the lights fail at 3:07 every night now. Maintenance finds nothing wrong.',
  'Don’t run. It hears you run. Stand still in a locker and it will walk right past. Mostly.',
  'The thing in the morgue only moves when you aren’t looking. Keep the beam on it.',
  'Dr. Hale stopped sleeping. He says the ward is learning how we move.',
  'If you hear whispering and nobody is there, take the pills. If it’s still there, take the stairs.',
  'The flares came from the boiler room. Someone took them before the power went. We never found who.',
  'Howlers were patients once. That scream is the last thing they were told.',
  'The exit lock needs fuses. Someone pulled them out and hid them. I think it was us.',
  'Crawlers hate fire. Hold a flare out and they scatter. I wrote it down so I wouldn’t forget.',
  'Mother said the dark can’t hurt you. Mother never worked in Ward 9.',
  'I counted the fuses twice. Two were missing, then three. The count keeps changing.',
  'Lit rooms are safe. It will not cross a working lamp. Stay where the light hums.',
  'Entry unsigned: we are not the patients. We are the ones it hasn’t taken yet.',
  'If you are reading this, you are further in than anyone. Don’t turn around.',
];
const lampIntensity = (m, t) => (m.broken ? (Math.sin(t * 23 + m.ph) * Math.sin(t * 7.3 + m.ph * 2) > 0.15 ? 0.95 : 0.1) : 0.8 + Math.sin(t * 50 + m.ph) * 0.03);

/* ───────────────────────────── audio ───────────────────────────── */
class AudioEngine {
  constructor() { this.ctx = null; this.vol = 0.7; this.muted = false; this.sched = { creak: 4, whisper: 9, beat: 0, clang: 14, kick: 0, n: 0 }; this.tens = 0; this.playing = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(c.destination);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(2.6, 2.4);
    const vg = c.createGain(); vg.gain.value = 0.42; this.verb.connect(vg); vg.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master); this.sfx.connect(this.verb);
    this.amb = c.createGain(); this.amb.gain.value = 1; this.amb.connect(this.master);
    this.noise = this.makeNoise(3);
    this.buildAmbience();
  }
  makeNoise(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  impulse(sec, decay) {
    const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  buildAmbience() {
    const c = this.ctx;
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0; this.droneGain.connect(this.amb);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 150; lp.Q.value = 5; lp.connect(this.droneGain);
    [[41.2, 'sawtooth'], [41.9, 'sawtooth'], [82.4, 'sine']].forEach(([f, t]) => { const o = c.createOscillator(); o.type = t; o.frequency.value = f; o.connect(lp); o.start(); });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 70; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const wind = c.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.8;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    wind.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.amb); wind.start();
    const wl = c.createOscillator(), wlg = c.createGain(); wl.frequency.value = 0.11; wlg.gain.value = 260; wl.connect(wlg); wlg.connect(bp.frequency); wl.start();
    this.tensGain = c.createGain(); this.tensGain.gain.value = 0; this.tensGain.connect(this.amb);
    [233.1, 246.9, 349.2].forEach((f) => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(this.tensGain); o.start(); });
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05); }
  setMuted(m) { this.muted = m; this.setVolume(this.vol); }
  setScene(playing) {
    this.playing = playing;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(playing ? 0.22 : 0.1, t, 0.8);
    this.windGain.gain.setTargetAtTime(playing ? 0.06 : 0.035, t, 0.8);
  }
  out(pan) {
    const c = this.ctx;
    if (!pan || !c.createStereoPanner) return this.sfx;
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(this.sfx);
    return p;
  }
  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.3, vol = 0.2, attack = 0.005, pan = 0, delay = 0, lp = 0, vib = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(this.out(pan));
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f0 * 0.04; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  burst({ dur = 0.1, vol = 0.2, f = 1000, f1 = null, q = 1, type = 'lowpass', pan = 0, delay = 0, attack = 0.002 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out(pan)); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  step(sprint, vol = 1) { this.burst({ dur: 0.09, vol: (sprint ? 0.11 : 0.06) * vol, f: sprint ? 900 : 500, q: 0.5 }); this.tone({ f0: 70, f1: 40, dur: 0.1, vol: 0.07 * vol }); }
  click(on = true) { this.burst({ dur: 0.03, vol: 0.12, f: 2500, type: 'highpass' }); this.tone({ f0: on ? 1500 : 900, dur: 0.03, vol: 0.05 }); }
  denied() { this.tone({ type: 'square', f0: 160, dur: 0.12, vol: 0.05 }); this.tone({ type: 'square', f0: 120, dur: 0.12, vol: 0.05, delay: 0.09 }); }
  pickup(kind) {
    const seq = { battery: [523, 659], medkit: [392, 494, 587], pills: [659, 784], flare: [330, 440], fuse: [392, 523, 659, 784] }[kind] || [440];
    seq.forEach((f, i) => this.tone({ f0: f, dur: 0.35, vol: 0.09, delay: i * 0.07, type: 'triangle' }));
  }
  flare() { this.burst({ dur: 0.7, vol: 0.2, f: 600, f1: 3500, q: 1.2, type: 'bandpass' }); this.burst({ dur: 0.25, vol: 0.12, f: 3000, type: 'highpass', delay: 0.05 }); }
  hit() { this.tone({ f0: 110, f1: 38, dur: 0.4, vol: 0.4 }); this.burst({ dur: 0.25, vol: 0.28, f: 1400, f1: 200 }); }
  growl(kind, pan = 0, vol = 1) {
    const base = kind === 'crawler' ? 150 : kind === 'stalker' ? 55 : 80;
    this.tone({ type: 'sawtooth', f0: base, f1: base * 0.6, dur: 0.9, vol: 0.2 * vol, pan, lp: 420, vib: 26, attack: 0.05 });
    this.burst({ dur: 0.7, vol: 0.1 * vol, f: 300, f1: 120, q: 3, type: 'bandpass', pan });
  }
  shriek(pan = 0, vol = 1) {
    this.tone({ type: 'sawtooth', f0: 700, f1: 1700, dur: 1.4, vol: 0.18 * vol, pan, lp: 3500, vib: 9, attack: 0.04 });
    this.tone({ type: 'sawtooth', f0: 950, f1: 1300, dur: 1.4, vol: 0.12 * vol, pan, lp: 3000, vib: 7, attack: 0.04 });
    this.burst({ dur: 1.2, vol: 0.08 * vol, f: 4000, type: 'highpass', pan });
  }
  stinger() { [220, 233.1, 311.1, 466.2].forEach((f) => this.tone({ type: 'sawtooth', f0: f, dur: 1.1, vol: 0.09, lp: 1800 })); this.burst({ dur: 0.5, vol: 0.3, f: 2000, f1: 200 }); }
  locked() { this.tone({ type: 'square', f0: 90, dur: 0.15, vol: 0.1 }); this.tone({ type: 'square', f0: 70, dur: 0.2, vol: 0.1, delay: 0.14 }); }
  powerUp() { this.tone({ type: 'sawtooth', f0: 60, f1: 600, dur: 1.4, vol: 0.14, lp: 1200 }); this.tone({ f0: 880, dur: 1.2, vol: 0.06, delay: 0.9 }); }
  death() { this.tone({ f0: 140, f1: 25, dur: 2.2, vol: 0.4, type: 'sawtooth', lp: 400 }); this.burst({ dur: 1.5, vol: 0.2, f: 1500, f1: 80 }); }
  win() { [262, 330, 392, 523].forEach((f, i) => this.tone({ f0: f, dur: 1.8, vol: 0.09, delay: i * 0.18, type: 'triangle' })); }
  alarm() { for (let i = 0; i < 8; i++) this.tone({ type: 'triangle', f0: i % 2 ? 640 : 880, dur: 0.32, vol: 0.12, delay: i * 0.34, lp: 2600 }); this.burst({ dur: 0.6, vol: 0.12, f: 3000, type: 'highpass' }); }
  ui() { this.tone({ f0: 420, f1: 300, dur: 0.07, vol: 0.05, type: 'triangle' }); }
  whisper(pan = 0) { for (let i = 0; i < 4; i++) this.burst({ dur: 0.25, vol: 0.07, f: rnd(1500, 2600), q: 7, type: 'bandpass', pan, delay: i * rnd(0.18, 0.3) }); }
  creak(pan = 0) { this.tone({ type: 'sawtooth', f0: rnd(90, 150), f1: rnd(60, 110), dur: rnd(0.7, 1.4), vol: 0.05, pan, lp: 500, vib: 6, attack: 0.2 }); }
  clang(pan = 0) { [523, 1170, 1840, 2650].forEach((f, i) => this.tone({ f0: f * rnd(0.98, 1.02), dur: 1.8 - i * 0.3, vol: 0.05 / (i + 1), pan })); }
  heartbeat(vol) { this.tone({ f0: 65, f1: 38, dur: 0.18, vol: 0.45 * vol }); this.tone({ f0: 60, f1: 35, dur: 0.2, vol: 0.32 * vol, delay: 0.17 }); }
  tick(dt, tension, sanity, hpFrac, chasing) {
    if (!this.ctx || !this.playing) return;
    const c = this.ctx, now = c.currentTime;
    this.tens += (tension - this.tens) * Math.min(1, dt * 1.5);
    this.tensGain.gain.setTargetAtTime(this.tens * 0.06, now, 0.3);
    const s = this.sched;
    s.creak -= dt; s.whisper -= dt; s.clang -= dt;
    if (s.creak <= 0) { s.creak = rnd(7, 16); this.creak(rnd(-0.8, 0.8)); }
    if (s.clang <= 0) { s.clang = rnd(20, 45); this.clang(rnd(-0.9, 0.9)); }
    if (s.whisper <= 0) { s.whisper = sanity < 50 ? rnd(3, 8) : rnd(25, 50); if (sanity < 70) this.whisper(rnd(-1, 1)); }
    if (chasing) { // pounding pursuit layer
      s.kick -= dt;
      if (s.kick <= 0) { s.kick = 0.46; s.n++; this.tone({ f0: 95, f1: 38, dur: 0.22, vol: 0.26 }); this.burst({ dur: 0.05, vol: 0.05, f: 6000, type: 'highpass', delay: 0.23 }); if (s.n % 4 === 0) this.tone({ type: 'sawtooth', f0: 233, dur: 0.5, vol: 0.05, lp: 900 }); }
    } else s.kick = 0.2;
    const bpm = Math.max(this.tens * 0.85, 1 - hpFrac > 0.5 ? (1 - hpFrac) : 0);
    if (bpm > 0.22) {
      s.beat -= dt;
      if (s.beat <= 0) { s.beat = lerp(1.1, 0.42, clamp(bpm, 0, 1)); this.heartbeat(clamp(bpm, 0.2, 1) * 0.6); }
    }
  }
}

/* ───────────────────────────── level ───────────────────────────── */
class Level {
  constructor(n, seed) {
    this.n = n;
    const rng = this.rng = mulberry32(seed);
    const R = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const W = this.w = this.h = Math.min(36 + n * 3, 62);
    this.tiles = new Uint8Array(W * W); // 0 wall, 1 floor, 2 solid prop
    this.roomAt = new Int16Array(W * W).fill(-1);
    this.explored = new Uint8Array(W * W);
    this.rooms = [];
    const want = Math.min(8 + n, 20);
    for (let t = 0; t < 700 && this.rooms.length < want; t++) {
      const rw = R(5, 11), rh = R(5, 10), rx = R(2, W - rw - 3), ry = R(2, W - rh - 3);
      if (this.rooms.some((r) => rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y)) continue;
      const id = this.rooms.length;
      this.rooms.push({ id, x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1), kind: R(0, 3) });
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { this.tiles[y * W + x] = 1; this.roomAt[y * W + x] = id; }
    }
    const carve = (x, y) => { if (this.tiles[y * W + x] === 0) this.tiles[y * W + x] = 1; };
    const link = (a, b) => {
      let x = a.cx, y = a.cy;
      const hz = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); carve(x, y); } };
      const vt = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); carve(x, y); } };
      if (rng() < 0.5) { hz(); vt(); } else { vt(); hz(); }
    };
    for (let i = 1; i < this.rooms.length; i++) {
      let best = 0, bd = 1e9;
      for (let j = 0; j < i; j++) { const d = Math.abs(this.rooms[i].cx - this.rooms[j].cx) + Math.abs(this.rooms[i].cy - this.rooms[j].cy); if (d < bd) { bd = d; best = j; } }
      link(this.rooms[i], this.rooms[best]);
    }
    const loops = 3 + (n >> 1);
    for (let k = 0; k < loops; k++) { const a = R(0, this.rooms.length - 1), b = R(0, this.rooms.length - 1); if (a !== b) link(this.rooms[a], this.rooms[b]); }

    // start, exit
    const startRoom = this.rooms[R(0, this.rooms.length - 1)];
    const d0 = this.bfs(startRoom.cx, startRoom.cy);
    let exitRoom = startRoom, far = -1;
    for (const r of this.rooms) { const d = d0[r.cy * W + r.cx]; if (d > far) { far = d; exitRoom = r; } }
    this.startRoom = startRoom; this.exitRoom = exitRoom; this.dist0 = d0;
    this.start = { x: (startRoom.cx + 0.5) * TS, y: (startRoom.cy + 0.5) * TS };
    this.exit = { x: (exitRoom.cx + 0.5) * TS, y: (exitRoom.cy + 0.5) * TS, tx: exitRoom.cx, ty: exitRoom.cy };

    // props (never in corridors, never blocking: all 8 neighbours must be open floor)
    for (const r of this.rooms) {
      const count = R(0, Math.floor((r.w * r.h) / 14));
      for (let k = 0; k < count * 3 && k < 30; k++) {
        const x = R(r.x + 2, r.x + r.w - 3), y = R(r.y + 2, r.y + r.h - 3);
        if (Math.abs(x - r.cx) <= 1 && Math.abs(y - r.cy) <= 1) continue;
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (this.tiles[(y + dy) * W + x + dx] !== 1) { ok = false; break; }
        if (ok) this.tiles[y * W + x] = 2;
      }
    }
    this.propKind = new Uint8Array(W * W);
    for (let i = 0; i < W * W; i++) if (this.tiles[i] === 2) this.propKind[i] = R(0, 2);

    { let lk = 0; const ps = [];
      for (let i = 0; i < W * W; i++) if (this.tiles[i] === 2) { ps.push(i); if (this.propKind[i] === 1) lk++; }
      for (let k = 0; k < ps.length && lk < Math.min(4, ps.length); k++) if (this.propKind[ps[k]] !== 1) { this.propKind[ps[k]] = 1; lk++; } }
    // ceiling lamps: the start room always has a steady one, other rooms sometimes have a failing one
    this.lamps = [];
    for (const r of this.rooms) {
      if (r !== startRoom && rng() > 0.4) continue;
      this.lamps.push({ x: (r.x + 1.5) * TS, y: (r.y + 1.5) * TS, r: 240, pts: null, ph: rng() * 100, broken: r !== startRoom && rng() < 0.5, on: 1 });
    }
    // contents
    const used = new Set();
    const freeTile = (room, minD = 0) => {
      for (let t = 0; t < 60; t++) {
        const x = R(room.x, room.x + room.w - 1), y = R(room.y, room.y + room.h - 1), i = y * W + x;
        if (this.tiles[i] === 1 && !used.has(i) && d0[i] >= minD) { used.add(i); return { x: (x + 0.5) * TS, y: (y + 0.5) * TS }; }
      }
      return { x: (room.cx + 0.5) * TS, y: (room.cy + 0.5) * TS };
    };
    this.freeTile = freeTile;
    used.add(startRoom.cy * W + startRoom.cx); used.add(exitRoom.cy * W + exitRoom.cx);
  }
  idx(tx, ty) { return ty * this.w + tx; }
  lampPts(m) { return m.pts || (m.pts = this.poly(m.x, m.y, 0, TAU, m.r, 56)); }
  solid(tx, ty) { return tx < 0 || ty < 0 || tx >= this.w || ty >= this.w || this.tiles[ty * this.w + tx] !== 1; }
  solidAt(x, y) { return this.solid(Math.floor(x / TS), Math.floor(y / TS)); }
  bfs(tx, ty) {
    const W = this.w, d = new Int16Array(W * W).fill(-1), q = new Int32Array(W * W);
    let h = 0, t = 0; const s = ty * W + tx; d[s] = 0; q[t++] = s;
    const T = this.tiles;
    while (h < t) {
      const i = q[h++], x = i % W, nd = d[i] + 1;
      if (x > 0 && T[i - 1] === 1 && d[i - 1] < 0) { d[i - 1] = nd; q[t++] = i - 1; }
      if (x < W - 1 && T[i + 1] === 1 && d[i + 1] < 0) { d[i + 1] = nd; q[t++] = i + 1; }
      if (i >= W && T[i - W] === 1 && d[i - W] < 0) { d[i - W] = nd; q[t++] = i - W; }
      if (i < W * W - W && T[i + W] === 1 && d[i + W] < 0) { d[i + W] = nd; q[t++] = i + W; }
    }
    return d;
  }
  /** distance from (x,y) along angle a to the first solid tile, capped at maxD (grid DDA). */
  cast(x, y, a, maxD) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const adx = Math.abs(dx) < 1e-9 ? 1e-9 : Math.abs(dx), ady = Math.abs(dy) < 1e-9 ? 1e-9 : Math.abs(dy);
    let mx = (dx > 0 ? (tx + 1) * TS - x : x - tx * TS) / adx;
    let my = (dy > 0 ? (ty + 1) * TS - y : y - ty * TS) / ady;
    const ddx = TS / adx, ddy = TS / ady;
    for (let i = 0; i < 80; i++) {
      let t;
      if (mx < my) { t = mx; tx += sx; mx += ddx; } else { t = my; ty += sy; my += ddy; }
      if (t >= maxD) return maxD;
      if (this.solid(tx, ty)) return t;
    }
    return maxD;
  }
  los(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    return this.cast(x1, y1, Math.atan2(dy, dx), d) >= d - 0.5;
  }
  /** flat [x0,y0,x1,y1,...] visibility polygon over angles a0..a1 */
  poly(x, y, a0, a1, r, n) {
    const out = new Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, d = this.cast(x, y, a, r);
      out[i * 2] = x + Math.cos(a) * (d + 2); out[i * 2 + 1] = y + Math.sin(a) * (d + 2);
    }
    return out;
  }
  /** push a circle out of solid tiles */
  collide(e, r) {
    for (let it = 0; it < 2; it++) {
      const x0 = Math.floor((e.x - r) / TS), x1 = Math.floor((e.x + r) / TS), y0 = Math.floor((e.y - r) / TS), y1 = Math.floor((e.y + r) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.solid(tx, ty)) continue;
        const cx = clamp(e.x, tx * TS, tx * TS + TS), cy = clamp(e.y, ty * TS, ty * TS + TS);
        let dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 < 1e-6) { // centre inside tile
          const l = e.x - tx * TS, rr = tx * TS + TS - e.x, t = e.y - ty * TS, b = ty * TS + TS - e.y, m = Math.min(l, rr, t, b);
          if (m === l) e.x = tx * TS - r; else if (m === rr) e.x = tx * TS + TS + r; else if (m === t) e.y = ty * TS - r; else e.y = ty * TS + TS + r;
        } else { const d = Math.sqrt(d2), p = r - d; e.x += (dx / d) * p; e.y += (dy / d) * p; }
      }
    }
  }
  reveal(x, y, r) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = tx + i, Y = ty + j;
      if (X >= 0 && Y >= 0 && X < this.w && Y < this.w && i * i + j * j <= r * r) this.explored[Y * this.w + X] = 1;
    }
  }
}

/* ───────────────────────────── sprites ───────────────────────────── */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
class Sprites {
  constructor() {
    const rng = mulberry32(1337);
    const noise = (g, w, h, n, a, light) => { for (let i = 0; i < n; i++) { g.fillStyle = (light ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (rng() * a).toFixed(3) + ')'; g.fillRect((rng() * w) | 0, (rng() * h) | 0, 1 + ((rng() * 2) | 0), 1 + ((rng() * 2) | 0)); } };
    const kinds = [
      { base: '#34383a', grout: null }, // concrete
      { base: '#3b4244', grout: 'rgba(0,0,0,.35)', checker: '#30373a' }, // hospital tile
      { base: '#3d2d22', plank: true }, // wood
      { base: '#2f3a35', grout: 'rgba(0,0,0,.25)' }, // linoleum
      { base: '#26292a', grout: null }, // corridor
    ];
    this.floor = kinds.map((k, ki) => Array.from({ length: 4 }, (_, v) => {
      const c = makeCanvas(TS, TS), g = c.getContext('2d');
      g.fillStyle = k.base; g.fillRect(0, 0, TS, TS);
      if (k.checker && (v & 1)) { g.fillStyle = k.checker; g.fillRect(0, 0, TS, TS); }
      if (k.plank) { for (let y = 0; y < TS; y += 12) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, y, TS, 1.5); g.fillStyle = `rgba(255,200,150,${0.02 + rng() * 0.04})`; g.fillRect(0, y + 2, TS, 9); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(((rng() * 40) | 0) + 4, y, 1.5, 12); } }
      if (k.grout) { g.strokeStyle = k.grout; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, TS - 1.5, TS - 1.5); }
      noise(g, TS, TS, 90, 0.16, false); noise(g, TS, TS, 40, 0.06, true);
      if (rng() < 0.45) { // stain
        const x = rng() * TS, y = rng() * TS, r = 5 + rng() * 14, gr = g.createRadialGradient(x, y, 0, x, y, r);
        const blood = ki === 3 || rng() < 0.3;
        gr.addColorStop(0, blood ? 'rgba(70,6,8,.55)' : 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, TS, TS);
      }
      if (rng() < 0.22) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.beginPath(); let x = rng() * TS, y = rng() * TS; g.moveTo(x, y); for (let i = 0; i < 4; i++) { x += (rng() - 0.5) * 18; y += (rng() - 0.3) * 14; g.lineTo(x, y); } g.stroke(); }
      return c;
    }));
    this.wall = Array.from({ length: 4 }, () => {
      const c = makeCanvas(TS, TS), g = c.getContext('2d');
      g.fillStyle = '#1b1e20'; g.fillRect(0, 0, TS, TS);
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
      for (let y = 0; y < TS; y += 12) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(TS, y + 0.5); g.stroke(); const off = (y / 12) % 2 ? 12 : 0; for (let x = off; x < TS; x += 24) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 12); g.stroke(); } }
      noise(g, TS, TS, 120, 0.3, false); noise(g, TS, TS, 40, 0.08, true);
      return c;
    });
    const ao = (w, h, x0, y0, x1, y1) => { const c = makeCanvas(w, h), g = c.getContext('2d'), gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); return c; };
    this.ao = { n: ao(TS, 16, 0, 0, 0, 16), s: ao(TS, 16, 0, 16, 0, 0), w: ao(16, TS, 0, 0, 16, 0), e: ao(16, TS, 16, 0, 0, 0) };
    // props
    const prop = (draw) => { const c = makeCanvas(TS, TS), g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(3, 5, TS - 4, TS - 4); draw(g); return c; };
    this.props = [
      prop((g) => { g.fillStyle = '#5a4026'; g.fillRect(3, 3, TS - 8, TS - 8); g.strokeStyle = '#2c1d0e'; g.lineWidth = 2; g.strokeRect(4, 4, TS - 10, TS - 10); g.beginPath(); g.moveTo(4, 4); g.lineTo(TS - 6, TS - 6); g.moveTo(TS - 6, 4); g.lineTo(4, TS - 6); g.stroke(); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(5, 5, TS - 12, 4); }),
      prop((g) => { g.fillStyle = '#4b5558'; g.fillRect(4, 3, TS - 9, TS - 8); g.fillStyle = '#394245'; g.fillRect(4, 3, (TS - 9) / 2 - 1, TS - 8); g.fillStyle = '#20282a'; g.fillRect(TS / 2 - 1, 3, 2, TS - 8); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(5, 4, TS - 11, 2); g.fillStyle = '#7a1c1c'; g.fillRect(10, 20, 4, 1); }),
      prop((g) => { g.fillStyle = '#6e6b62'; g.fillRect(5, 3, TS - 10, TS - 8); g.fillStyle = '#8f8a7c'; g.fillRect(7, 5, TS - 14, 14); g.fillStyle = '#4a0c0c'; g.beginPath(); g.ellipse(24, 30, 9, 5, 0.3, 0, TAU); g.fill(); g.fillStyle = '#3c3f42'; g.fillRect(5, TS - 10, TS - 10, 2); }),
    ];
    // vignette / grain
    this.vignette = null;
    this.grain = Array.from({ length: 4 }, () => { const c = makeCanvas(160, 160), g = c.getContext('2d'), d = g.createImageData(160, 160); for (let i = 0; i < d.data.length; i += 4) { const v = (Math.random() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c; });
  }
  makeVignette(w, h) {
    const c = makeCanvas(w, h), g = c.getContext('2d'), r = Math.hypot(w, h) / 2;
    const gr = g.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.65, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,.97)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); this.vignette = c;
  }
}

/* ───────────────────────────── entities ───────────────────────────── */
const ENEMY = {
  wraith: { r: 17, patrol: 86, chase: 164, dmg: 24, sight: 450, fov: 1.9, hear: 1.1, cd: 1.0, label: 'a Wraith' },
  crawler: { r: 13, patrol: 72, chase: 224, dmg: 14, sight: 310, fov: 2.9, hear: 1.6, cd: 0.7, label: 'a Crawler' },
  stalker: { r: 16, patrol: 0, chase: 180, dmg: 38, sight: 0, fov: 0, hear: 0, cd: 1.4, label: 'the Stalker' },
  howler: { r: 18, patrol: 0, chase: 0, dmg: 0, sight: 480, fov: 2.4, hear: 0, cd: 0, label: 'a Howler' },
};

class Enemy {
  constructor(type, x, y, g) {
    this.type = type; this.cfg = ENEMY[type]; this.x = x; this.y = y; this.r = this.cfg.r;
    this.angle = rnd(TAU); this.state = 'patrol'; this.t = rnd(10); this.cd = 0; this.stun = 0; this.loseT = 0; this.pause = rnd(0.5, 2);
    this.field = null; this.target = null; this.last = null; this.vx = 0; this.vy = 0; this.wake = type === 'stalker' ? rnd(10, 18) : 0; this.shriekCd = 0; this.lit = false;
    this.pickPatrol(g);
  }
  pickPatrol(g) {
    const L = g.level, room = pick(L.rooms);
    this.target = { x: room.cx, y: room.cy }; this.field = L.bfs(room.cx, room.cy); this.pause = rnd(0.8, 3);
  }
  goTo(g, tx, ty) { this.target = { x: tx, y: ty }; this.field = g.level.bfs(tx, ty); }
  stepField(g, field, speed, dt) {
    const L = g.level, W = L.w, tx = Math.floor(this.x / TS), ty = Math.floor(this.y / TS), here = field[ty * W + tx];
    let bx = tx, by = ty, bd = here < 0 ? 1e9 : here;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (!i && !j) continue;
      const X = tx + i, Y = ty + j; if (X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const v = field[Y * W + X]; if (v < 0 || v >= bd) continue;
      if (i && j && (L.solid(tx + i, ty) || L.solid(tx, ty + j))) continue;
      bd = v; bx = X; by = Y;
    }
    if (bx === tx && by === ty) return here === 0;
    const px = (bx + 0.5) * TS, py = (by + 0.5) * TS, dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy) || 1;
    this.move(g, dx / d, dy / d, speed, dt);
    return false;
  }
  move(g, nx, ny, speed, dt) {
    this.vx = lerp(this.vx, nx * speed, Math.min(1, dt * 8)); this.vy = lerp(this.vy, ny * speed, Math.min(1, dt * 8));
    this.x += this.vx * dt; this.y += this.vy * dt; g.level.collide(this, this.r);
    if (Math.hypot(this.vx, this.vy) > 8) this.angle = lerpAngle(this.angle, Math.atan2(this.vy, this.vx), Math.min(1, dt * 9));
  }
  update(g, dt) {
    const P = g.player, L = g.level, cfg = this.cfg;
    this.t += dt; this.cd -= dt; this.stun -= dt; this.shriekCd -= dt;
    const dx = P.x - this.x, dy = P.y - this.y, d = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
    this.dist = d;
    this.lit = g.isLit(this.x, this.y, this.type !== 'stalker');
    const sk = g.skill;

    if (this.type === 'howler') {
      this.angle = lerpAngle(this.angle, g.attract ? this.angle + 0.3 : (d < cfg.sight ? toP : this.angle + Math.sin(this.t * 0.4) * 0.01), Math.min(1, dt * 3));
      if (!g.attract && !P.hidden && this.shriekCd <= 0 && d < cfg.sight && L.los(this.x, this.y, P.x, P.y)) { this.shriekCd = 9; g.onShriek(this); }
      return;
    }
    if (this.type === 'stalker') {
      if (g.attract || g.time < this.wake) return;
      this.angle = lerpAngle(this.angle, toP, Math.min(1, dt * 4));
      if (!this.lit) {
        if (g.playerField) { if (d > 90 && !(d < 300 && L.los(this.x, this.y, P.x, P.y))) this.stepField(g, g.playerField, cfg.chase * sk, dt); else this.move(g, dx / d, dy / d, cfg.chase * sk, dt); }
        this.vx *= 0.5; this.vy *= 0.5;
      } else { this.vx = this.vy = 0; if (!this.noticed) { this.noticed = true; g.onNotice(this); } }
      if (d < this.r + 16 + 6 && this.cd <= 0 && !P.hidden) { this.cd = cfg.cd; g.hurt(cfg.dmg, this); }
      return;
    }

    // wraith / crawler
    if (this.stun > 0) {
      let fx = 0, fy = 0;
      for (const f of g.flares) { const ax = this.x - f.x, ay = this.y - f.y, ad = Math.hypot(ax, ay) || 1; if (ad < 420) { fx += ax / ad; fy += ay / ad; } }
      const fl = Math.hypot(fx, fy) || 1; this.move(g, fx / fl, fy / fl, cfg.chase * 0.8, dt); return;
    }
    if (g.attract) { // attract-mode: gentle patrol only
      if (this.stepField(g, this.field, cfg.patrol * 0.6, dt)) this.pickPatrol(g); return;
    }
    let sees = false;
    const lightMult = (P.lightOn && P.battery > 0 ? 1.15 : 0.55) * (P.sprint ? 1.25 : 1) * sk;
    if (!P.hidden && d < cfg.sight * lightMult && (d < 70 || Math.abs(angDiff(toP, this.angle)) < cfg.fov / 2) && L.los(this.x, this.y, P.x, P.y)) sees = true;
    const heard = P.noise > 0 && d < P.noise * cfg.hear * sk;

    if (sees) {
      if (this.state !== 'chase') g.onNotice(this);
      this.state = 'chase'; this.loseT = 0; this.last = { x: P.x, y: P.y };
    } else if (this.state === 'chase') {
      this.loseT += dt;
      if (this.loseT > 3.5) { this.state = 'search'; this.goTo(g, Math.floor(this.last.x / TS), Math.floor(this.last.y / TS)); }
    } else if (heard && this.state !== 'investigate') {
      this.state = 'investigate'; this.goTo(g, Math.floor(P.x / TS), Math.floor(P.y / TS)); this.pause = 0;
    }

    if (this.state === 'chase') {
      const sp = cfg.chase * sk;
      if (d < 420 && L.los(this.x, this.y, P.x, P.y)) this.move(g, dx / d, dy / d, sp, dt);
      else if (g.playerField) this.stepField(g, g.playerField, sp, dt);
      if (d < this.r + 16 + 4 && this.cd <= 0 && !P.hidden) { this.cd = cfg.cd; g.hurt(cfg.dmg, this); }
    } else if (this.state === 'investigate' || this.state === 'search') {
      if (this.pause > 0) { this.pause -= dt; this.angle += dt * 1.4; if (this.pause <= 0) { this.state = 'patrol'; this.pickPatrol(g); } }
      else if (this.stepField(g, this.field, cfg.patrol * 1.5 * sk, dt)) { this.pause = rnd(1.5, 3); }
    } else {
      if (this.pause > 0) { this.pause -= dt; this.angle += Math.sin(this.t * 1.7) * dt; this.vx *= 0.8; this.vy *= 0.8; }
      else if (this.stepField(g, this.field, cfg.patrol * sk, dt)) { this.pause = rnd(1, 3); if (Math.random() < 0.7) this.pickPatrol(g); }
    }
  }
}

/* ───────────────────────────── game ───────────────────────────── */
class Game {
  constructor() {
    this.cv = $('stage'); this.ctx = this.cv.getContext('2d');
    this.lightCv = makeCanvas(2, 2); this.lctx = this.lightCv.getContext('2d');
    this.audio = new AudioEngine();
    this.sprites = new Sprites();
    this.settings = Object.assign({ volume: 70, quality: 'medium', shake: !matchMedia('(prefers-reduced-motion: reduce)').matches, haptics: true, brightness: 50, fps: false, difficulty: 'normal', view: 'auto', sens: 50 }, store.get('settings', {}));
    this.notesFound = store.get('notes', []); this.diff = { m: 1, s: 1 }; this.story = store.get('story', null); this.hints = store.get('hints', {}); this.radioQ = []; this.use3d = false; this.view3d = null; this.look = { x: 0, y: 0 }; this.locked = false; this.fail3d = 0; this.pressureEvery = 38;
    this.scores = Object.assign({ survival: [], speedrun: [], story: [] }, store.get('scores', {}));
    this.playerName = store.get('name', '');
    this.keys = new Set(); this.mouse = { x: 0, y: 0, has: false }; this.pad = null;
    this.touch = { mx: 0, my: 0, ax: 0, ay: 0, aiming: false, run: false };
    this.state = 'boot'; this.mode = 'survival'; this.skill = 1; this.time = 0; this.fade = 1; this.cam = { x: 0, y: 0, shake: 0 };
    this.flares = []; this.particles = []; this.enemies = []; this.pickups = []; this.fuses = []; this.halluc = []; this.attract = true;
    this.fps = 60; this.fpsAcc = 0; this.fpsN = 0; this.slow = 0; this.lastHud = {};
    this.resize(); addEventListener('resize', () => this.resize());
    this.bindInput(); this.bindUI(); this.applySettings();
    this.loadAttract();
    this.last = performance.now(); requestAnimationFrame((t) => this.frame(t));
  }

  /* ---- setup ---- */
  get qual() { return { low: { ls: 0.4, rays: 0.6, dpr: 1 }, medium: { ls: 0.55, rays: 1, dpr: 1 }, high: { ls: 0.8, rays: 1.4, dpr: Math.min(devicePixelRatio || 1, 1.75) } }[this.qOverride || this.settings.quality] || { ls: 0.55, rays: 1, dpr: 1 }; }
  resize() {
    const q = this.qual, w = Math.floor(innerWidth * q.dpr), h = Math.floor(innerHeight * q.dpr);
    this.cv.width = w; this.cv.height = h; this.dpr = q.dpr;
    this.lightCv.width = Math.max(2, Math.floor(w * q.ls)); this.lightCv.height = Math.max(2, Math.floor(h * q.ls)); this.ls = q.ls;
    this.zoom = clamp(h / 780, 0.55, 2.2);
    if (this.view3d) this.view3d.resize();
    this.sprites.makeVignette(Math.min(w, 960), Math.min(h, 960 * h / w) | 0 || 540);
  }
  applySettings() {
    const s = this.settings;
    this.audio.vol = s.volume / 100; if (this.audio.master) this.audio.setVolume(s.volume / 100);
    $('opt-view').value = s.view; $('opt-sens').value = s.sens; $('opt-sens-val').textContent = s.sens + '%'; $('opt-difficulty').value = s.difficulty; $('opt-volume').value = s.volume; $('opt-quality').value = s.quality; $('opt-brightness').value = s.brightness;
    $('opt-shake').checked = s.shake; $('opt-haptics').checked = s.haptics; $('opt-fps').checked = s.fps;
    $('opt-volume-val').textContent = s.volume + '%'; $('opt-brightness-val').textContent = s.brightness + '%';
    $('fps').hidden = !s.fps;
    store.set('settings', s);
  }
  loadAttract() {
    document.body.classList.remove('mode3d'); this.clearRadio(); $('btn-continue').hidden = !this.story; if (this.story) $('btn-continue').textContent = 'Continue story, ward ' + this.story.ward;
    this.attract = true; this.level = new Level(3, (Math.random() * 1e9) | 0);
    const L = this.level; this.setupEntities(true);
    const big = L.rooms.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    this.player = this.makePlayer(); this.player.x = (big.cx + 0.5) * TS; this.player.y = (big.cy + 0.5) * TS;
    this.cam.x = this.player.x - this.cv.width / this.zoom / 2; this.cam.y = this.player.y - this.cv.height / this.zoom / 2;
    this.showScreen('menu'); this.state = 'menu'; this.hud(false); this.audio.setScene(false);
    this.enemies = this.enemies.filter((e) => e.type === 'wraith' || e.type === 'crawler').slice(0, 3);
    this.time = 0;
  }
  makePlayer() { return { pitch: 0, hideTile: null, x: 0, y: 0, vx: 0, vy: 0, r: 13, angle: 0, hp: 100, sanity: 100, battery: 100, stamina: 100, exhausted: false, flares: 2, lightOn: true, sprint: false, noise: 0, noiseBoost: 0, stride: 0, flicker: 0, moving: false, bob: 0 }; }
  makeLevel(n) {
    this.level = new Level(n, (Math.random() * 1e9) | 0);
    this.setupEntities(false);
  }
  setupEntities(attract) {
    const L = this.level, n = L.n, g = this;
    this.flares = []; this.particles = []; this.halluc = []; this.enemies = []; this.pickups = []; this.fuses = [];
    // fuses
    const need = this.mode === 'speedrun' ? Math.min(2 + (n >> 1), 4) : Math.min(2 + (n >> 1), 5);
    this.fuseNeed = attract ? 0 : need; this.fuseGot = 0;
    const cand = L.rooms.filter((r) => r !== L.startRoom && r !== L.exitRoom).sort(() => Math.random() - 0.5);
    for (let i = 0; i < need; i++) { const r = cand[i % cand.length]; const p = L.freeTile(r, 10); this.fuses.push({ x: p.x, y: p.y, got: false, t: rnd(6) }); }
    // pickups, fewer as you descend; director scales by skill
    const sc = 1 / this.skill;
    const counts = { battery: Math.round(Math.max(2, 4 - n / 3) * sc), medkit: Math.round(Math.max(1, 2.5 - n / 3) * sc), pills: Math.round(Math.max(1, 2.5 - n / 3) * sc), flare: Math.round(2 * sc) };
    for (const [kind, c] of Object.entries(counts)) for (let i = 0; i < c; i++) { const p = L.freeTile(pick(L.rooms), 4); this.pickups.push({ kind, x: p.x, y: p.y, t: rnd(6) }); }
    if (!attract) { const unread = NOTES.map((_, i) => i).filter((i) => !this.notesFound.includes(i)); const idx = unread.length ? pick(unread) : rint(0, NOTES.length - 1); const p = L.freeTile(pick(L.rooms), 4); this.pickups.push({ kind: 'note', x: p.x, y: p.y, t: rnd(6), idx }); }
    // enemies
    const spawn = (type, k) => { for (let i = 0; i < k; i++) { let p = null; for (let t = 0; t < 40; t++) { const r = pick(L.rooms); p = L.freeTile(r, 22); if (L.dist0[Math.floor(p.y / TS) * L.w + Math.floor(p.x / TS)] >= 22) break; } this.enemies.push(new Enemy(type, p.x, p.y, g)); } };
    spawn('wraith', Math.min(1 + (n >> 1) + (n >= 4 ? 1 : 0), 6));
    if (n >= 2) spawn('crawler', Math.min(((n - 1) >> 1) + 1 + (n >= 5 ? 1 : 0), 6));
    if (n >= 3) spawn('stalker', Math.min(1 + ((n - 3) >> 2), 3));
    if (n >= 4) spawn('howler', Math.min(1 + ((n - 4) / 4 | 0), 3));
  }

  /* ---- runs ---- */
  async startRun(mode, resume) {
    if (this.starting) return; this.starting = true;
    this.audio.init(); this.audio.setScene(true);
    this.mode = mode; this.attract = false;
    this.diff = { easy: { m: 0.85, s: 0.7 }, normal: { m: 1.05, s: 1 }, nightmare: { m: 1.25, s: 1.6 } }[this.settings.difficulty] || { m: 1.05, s: 1 }; this.skill = this.diff.m;
    this.pressureEvery = { easy: 55, normal: 38, nightmare: 26 }[this.settings.difficulty] || 38;
    this.run = { score: 0, time: 0, damage: 0, fuses: 0, level: 1, deaths: 0, startedAt: Date.now() };
    this.player = this.makePlayer();
    let ward = 1;
    if (resume && this.story) { const sv = this.story; ward = sv.ward; this.run.score = sv.score; this.run.deaths = sv.deaths || 0; this.run.time = sv.time || 0; Object.assign(this.player, { hp: sv.hp, sanity: sv.sanity, battery: sv.battery, flares: sv.flares }); }
    try { await this.ensureView(); } finally { this.starting = false; }
    if (mode === 'story' && !resume) this.showStory(STORY.intro, () => this.beginLevel(1), 'Prologue');
    else this.beginLevel(ward);
  }
  wants3D() { const v = this.settings.view; return v !== '2d' && webglOk(); }
  async ensureView() {
    if (!this.wants3D()) { this.use3d = false; return; }
    if (!this.view3d) {
      try { const mod = await import('./js/view3d.js'); this.view3d = await mod.createView(this); }
      catch (err) { console.warn('3D view unavailable, using the top-down view:', err); this.use3d = false; this.view3dFailed = true; return; }
    }
    this.use3d = true;
    if (!this.ctxLostBound) { this.ctxLostBound = true; this.view3d.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.use3d = false; document.body.classList.remove('mode3d'); this.toast('The graphics context was lost. Switched to the top-down view.'); }); }
  }
  lock() {
    if (!this.use3d || this.isTouch || !this.view3d) return;
    const cv = this.view3d.canvas; if (document.pointerLockElement === cv) return;
    try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* needs a user gesture */ }
  }
  pan(x, y, range = 500) { const P = this.player; return this.use3d ? Math.sin(angDiff(Math.atan2(y - P.y, x - P.x), P.angle)) : clamp((x - P.x) / range, -1, 1); }

  /* ---- story, radio and hints ---- */
  showStory(lines, done, title) {
    this.clearRadio(); this.state = this.state === 'play' ? 'clear' : 'story'; this.hud(false);
    const box = $('story-text'); box.innerHTML = ''; $('story-title').textContent = title || ''; this.storyDone = done; this.storyFinished = false;
    const btn = $('story-skip'); btn.textContent = 'Skip';
    this.showScreen('story'); document.body.classList.remove('mode3d');
    clearTimeout(this.storyT); let i = 0;
    const finish = () => { clearTimeout(this.storyT); this.storyFinished = true; box.innerHTML = lines.map((l) => '<p>' + l + '</p>').join(''); btn.textContent = 'Continue'; btn.focus({ preventScroll: true }); };
    this.storyFinish = finish;
    const next = () => {
      if (i >= lines.length) { finish(); return; }
      const p = document.createElement('p'); box.appendChild(p); const text = lines[i++]; let c = 0;
      const tick = () => { p.textContent = text.slice(0, ++c); if (c < text.length) this.storyT = setTimeout(tick, 30); else this.storyT = setTimeout(next, 1300); };
      tick();
    };
    next();
  }
  storyAdvance() {
    if (!this.storyFinished) { this.storyFinish(); return; }
    const cb = this.storyDone; this.storyDone = null; this.audio.ui(); if (cb) cb();
  }
  radio(who, text, secs = 6.5) { this.radioQ.push({ who, text, secs }); if (!this.radioBusy) this.nextRadio(); }
  nextRadio() {
    clearTimeout(this.radioT); clearTimeout(this.radioTyping);
    const m = this.radioQ.shift(); const el = $('radio');
    if (!m) { this.radioBusy = false; el.classList.remove('show'); return; }
    this.radioBusy = true; $('radio-who').textContent = m.who; el.classList.add('show'); this.audio.click(true);
    const tp = $('radio-text'); let c = 0; const tick = () => { tp.textContent = m.text.slice(0, ++c); if (c < m.text.length) this.radioTyping = setTimeout(tick, 22); };
    tick(); this.radioT = setTimeout(() => this.nextRadio(), m.secs * 1000 + m.text.length * 22);
  }
  clearRadio() { this.radioQ = []; this.radioBusy = false; clearTimeout(this.radioT); clearTimeout(this.radioTyping); const el = $('radio'); if (el) el.classList.remove('show'); }
  hint(key, text) {
    if (this.hints[key] || this.state !== 'play') return;
    this.hints[key] = 1; store.set('hints', this.hints);
    this.radio(this.mode === 'story' ? 'Wren' : 'Tip', text, 5.5);
  }
  storyMsg(kind) {
    if (this.mode !== 'story') return;
    const w = STORY.wards[this.run.level]; if (w && w[kind]) this.radio(kind === 'done' ? 'Wren' : 'Wren', w[kind], 7);
  }
  beginLevel(n, retry) {
    this.makeLevel(n); const L = this.level, P = this.player;
    P.x = L.start.x; P.y = L.start.y; P.vx = P.vy = 0; P.pitch = 0; P.hidden = false; P.hideTile = null; P.hideK = 0;
    if (!retry) { P.sanity = Math.min(100, P.sanity + 20); P.hp = Math.min(100, P.hp + (n > 1 ? 8 : 0)); }
    this.wardStart = { hp: P.hp, sanity: P.sanity, battery: P.battery, flares: P.flares };
    this.run.level = n; this.run.levelTime = 0; this.run.levelDamage = 0; this.time = 0; this.fade = 1; this.pressureT = (this.mode === 'story' && n === 1) ? 1e9 : this.pressureEvery * 0.9; this.lastExposed = { x: P.x, y: P.y };
    this.cam.x = P.x - this.cv.width / this.zoom / 2; this.cam.y = P.y - this.cv.height / this.zoom / 2;
    this.playerField = null; this.fieldT = 0; this.shakeT = 0; this.threat = 0; this.msgT = 0; this.damageFlash = 0; this.glitch = 0;
    L.reveal(P.x, P.y, 6);
    this.clearRadio(); $('toast').classList.remove('show');
    if (this.use3d && this.view3d) { this.view3d.loadLevel(L); this.lock(); }
    document.body.classList.toggle('mode3d', !!(this.use3d && this.view3d));
    this.state = 'play'; this.showScreen(null); this.hud(true);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const story = this.mode === 'story';
    $('hud-level').textContent = 'Ward ' + n; $('card-title').textContent = wardName(n, this.mode);
    $('card-sub').textContent = this.mode === 'speedrun' ? 'Speedrun · ' + n + ' of 5' : story ? 'Chapter ' + roman(n) + ' of VII' : 'Level ' + n;
    const card = $('card'); card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    if (story) {
      this.story = { ward: n, score: this.run.score, deaths: this.run.deaths, time: this.run.time, hp: P.hp, sanity: P.sanity, battery: P.battery, flares: P.flares }; store.set('story', this.story);
      const w = STORY.wards[n]; if (w) setTimeout(() => { if (this.state === 'play') { this.toast(w.brief, 5); this.storyMsg('open'); } }, 2600);
    } else this.toast(n === 1 ? 'Find the fuses. Restore the lift.' : 'Find the fuses. Don’t be found.', 4);
    this.audio.setScene(true);
  }
  retryWard() {
    const r = this.run, s = this.wardStart; r.deaths++; r.score = Math.round(r.score * 0.85);
    Object.assign(this.player, this.makePlayer(), { hp: Math.max(60, s.hp), sanity: Math.max(60, s.sanity), battery: Math.max(55, s.battery), flares: Math.max(2, s.flares) });
    this.beginLevel(r.level, true);
  }
  completeLevel() {
    if (this.state !== 'play') return;
    const r = this.run, n = r.level, par = 80 + n * 25, bonus = Math.max(0, Math.round((par - r.levelTime) * 4));
    this.addScore(500 * n + bonus);
    this.skill = clamp(this.skill + (r.levelDamage < 30 && r.levelTime < par ? 0.08 : r.levelDamage > 80 ? -0.08 : 0), this.diff.m - 0.12, this.diff.m + 0.25);
    this.state = 'clear'; this.audio.win();
    const story = this.mode === 'story', final = (this.mode === 'speedrun' && n >= 5) || (story && n >= 7), sw = story && STORY.wards[n];
    $('clear-title').textContent = final ? (story ? 'The lift reaches the bottom.' : 'You got out.') : 'Ward cleared';
    $('clear-quote').textContent = sw && !final ? '“' + sw.done + '”' : ''; $('clear-quote').hidden = !(sw && !final);
    $('clear-stats').innerHTML = `<dt>Time</dt><dd>${fmtTime(r.levelTime)}</dd><dt>Damage taken</dt><dd>${Math.round(r.levelDamage)}</dd><dt>Time bonus</dt><dd>+${bonus}</dd>${story ? `<dt>Times you died</dt><dd>${r.deaths}</dd>` : ''}<dt>Score</dt><dd>${r.score}</dd>`;
    if (final) {
      if (story) { const e = this.notesFound.length >= 10 ? STORY.endings.truth : STORY.endings.escape; this.story = null; store.set('story', null); this.showStory(e.lines, () => this.finishRun(true), e.title); }
      else this.finishRun(true);
      return;
    }
    $('clear-next').textContent = 'Descend to ward ' + (n + 1);
    $('clear-name-row').hidden = true; $('clear-actions-end').hidden = true; $('clear-next').hidden = false;
    this.showScreen('clear'); this.vibrate([40, 60, 40]);
  }
  /** Pressure aims at where you were last exposed, with scatter, so it never reads your live position while you hide. */
  pressureTarget() {
    const L = this.level, lx = Math.floor(this.lastExposed.x / TS), ly = Math.floor(this.lastExposed.y / TS);
    for (let k = 0; k < 40; k++) { const x = lx + rint(-6, 6), y = ly + rint(-6, 6); if (!L.solid(x, y)) return { x, y }; }
    return { x: lx, y: ly };
  }
  /** The lift alarm: when the last fuse goes in, every hunter is sent to the lift. */
  liftAlarm() {
    const ex = this.level.exit; this.audio.alarm(); this.cam.shake = Math.max(this.cam.shake, 8);
    for (const e of this.enemies) if (e.type === 'wraith' || e.type === 'crawler') { e.state = 'investigate'; e.goTo(this, ex.tx, ex.ty); e.pause = 0; }
    if (this.mode === 'story') this.radio('Wren', STORY.alarm, 5); else this.toast('The lift alarm is screaming. Everything heard it.', 4);
  }
  addScore(n) { this.run.score += Math.round(n * this.diff.s); }
  nextLevel() { if (this.state === 'clear') { this.audio.ui(); this.beginLevel(this.run.level + 1); } }
  hurt(dmg, src) {
    const P = this.player; if (this.state !== 'play') return;
    P.hp -= dmg; this.run.damage += dmg; this.run.levelDamage += dmg; this.damageFlash = 1; this.cam.shake = Math.max(this.cam.shake, 14);
    P.sanity = Math.max(0, P.sanity - dmg * 0.4); this.audio.hit(); this.vibrate([80]); this.glitch = 0.6;
    const a = Math.atan2(P.y - src.y, P.x - src.x); P.vx += Math.cos(a) * 320; P.vy += Math.sin(a) * 320;
    for (let i = 0; i < 12; i++) this.particles.push({ x: P.x, y: P.y, vx: Math.cos(a + rnd(-1, 1)) * rnd(60, 240), vy: Math.sin(a + rnd(-1, 1)) * rnd(60, 240), life: rnd(0.4, 0.9), max: 0.9, c: 'rgba(120,10,14,', s: rnd(1.5, 3.5), f: 4 });
    if (P.hp <= 0) this.die(src.cfg ? src.cfg.label : 'the dark', src);
  }
  die(cause) {
    this.state = 'dead'; this.deadT = 0; this.audio.death(); this.vibrate([200, 80, 300]);
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
    this.cause = cause;
  }
  showDeath() {
    const r = this.run;
    $('death-cause').textContent = (this.player.sanity <= 0 && this.player.hp <= 0 && this.cause === 'the dark' ? 'Your mind went first.' : 'Killed by ' + this.cause + '.') + (this.mode === 'story' ? ' Far away, a voice says: “Ren? Ren, get up.”' : '');
    $('death-retry').textContent = this.mode === 'story' ? 'Try this ward again' : 'Try again';
    const survival = this.mode === 'survival';
    $('death-stats').innerHTML = `<dt>Ward reached</dt><dd>${r.level}</dd><dt>Survived</dt><dd>${fmtTime(r.time)}</dd><dt>Fuses restored</dt><dd>${r.fuses}</dd><dt>Score</dt><dd>${r.score + (survival ? r.fuses * 0 : 0)}</dd>`;
    $('death-name-row').hidden = !(survival && r.score > 0);
    $('death-name').value = this.playerName;
    this.showScreen('death');
    this.recorded = false;
    if (survival && r.score > 0) setTimeout(() => $('death-name').focus(), 400);
  }
  finishRun(won) {
    const r = this.run;
    $('clear-name-row').hidden = false; $('clear-name').value = this.playerName; $('clear-actions-end').hidden = false; $('clear-next').hidden = true;
    $('clear-stats').insertAdjacentHTML('beforeend', `<dt>Total time</dt><dd>${fmtTimeMs(r.time)}</dd>`);
    $('clear-save').textContent = this.mode === 'speedrun' ? 'Save time' : 'Save score';
    this.state = 'clear'; this.recorded = false; this.showScreen('clear');
  }
  record(mode, nameInput, quiet) {
    if (this.recorded) return; this.recorded = true;
    const r = this.run, name = (nameInput.value.trim() || 'Unknown patient').slice(0, 14);
    this.playerName = name; store.set('name', name);
    const entry = { name, score: r.score, level: r.level, time: r.time, date: Date.now(), diff: this.settings.difficulty };
    const list = this.scores[mode]; list.push(entry);
    list.sort(mode !== 'speedrun' ? (a, b) => b.score - a.score : (a, b) => a.time - b.time);
    this.scores[mode] = list.slice(0, 10); store.set('scores', this.scores);
    this.lastEntry = entry;
    if (!quiet) { this.audio.ui(); this.openLeaderboard(mode); }
  }
  readNote(idx) {
    if (!this.notesFound.includes(idx)) { this.notesFound.push(idx); store.set('notes', this.notesFound); }
    this.toast('Note found: “' + NOTES[idx] + '”', 8);
  }
  openNotes() {
    const el = $('notes-list'); el.innerHTML = '';
    NOTES.forEach((t, i) => { const li = document.createElement('li'); const f = this.notesFound.includes(i); li.className = f ? '' : 'locked'; li.textContent = f ? t : 'Not found yet.'; el.appendChild(li); });
    $('notes-count').textContent = this.notesFound.length + ' of ' + NOTES.length + ' found';
    this.showScreen('notes');
  }
  hud(on) { $('hud').hidden = !on; $('touch').hidden = !(on && this.isTouch); }

  /* ---- ui ---- */
  showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    this.screenName = name;
    if (name && document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } } // menus need a free cursor
    const first = name && document.querySelector('#screen-' + name + ' [data-autofocus]');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
  }
  toast(msg, secs = 2.2) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); this.msgT = secs; }
  vibrate(p) { if (this.settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } }
  openLeaderboard(mode) {
    this.lbMode = mode || this.lbMode || 'survival';
    document.querySelectorAll('.tab').forEach((t) => { const on = t.dataset.mode === this.lbMode; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    const list = this.scores[this.lbMode], el = $('lb-rows');
    el.innerHTML = '';
    if (!list.length) { el.innerHTML = '<li class="empty">No survivors on record. Be the first.</li>'; }
    list.forEach((e, i) => {
      const li = document.createElement('li'); if (e === this.lastEntry || (this.lastEntry && e.date === this.lastEntry.date && e.name === this.lastEntry.name)) li.className = 'you';
      const val = this.lbMode !== 'speedrun' ? String(e.score).padStart(6, ' ') : fmtTimeMs(e.time);
      const cells = [String(i + 1), e.name, val, this.lbMode !== 'speedrun' ? 'Ward ' + e.level + (e.diff && e.diff !== 'normal' ? ' · ' + e.diff : '') : fmtDate(e.date) + (e.diff && e.diff !== 'normal' ? ' · ' + e.diff : '')];
      cells.forEach((c, k) => { const s = document.createElement('span'); s.textContent = c; if (k === 2) s.className = 'num'; li.appendChild(s); });
      el.appendChild(li);
    });
    $('lb-head-val').textContent = this.lbMode !== 'speedrun' ? 'Score' : 'Time'; $('lb-head-extra').textContent = this.lbMode !== 'speedrun' ? 'Reached' : 'Date';
    this.showScreen('leaderboard');
  }
  pause() { if (this.state !== 'play') return; this.state = 'paused'; this.showScreen('pause'); this.audio.setScene(false); }
  resume() { if (this.state !== 'paused') return; this.state = 'play'; this.showScreen(null); this.audio.setScene(true); this.last = performance.now(); this.lock(); }
  toMenu() { this.audio.ui(); this.loadAttract(); }
  bindUI() {
    const on = (id, fn) => $(id).addEventListener('click', () => { this.audio.init(); fn(); });
    const ui = () => this.audio.ui();
    on('btn-start', () => { ui(); this.startRun('story'); });
    on('btn-continue', () => { ui(); this.startRun('story', true); });
    on('btn-endless', () => { ui(); this.startRun('survival'); });
    on('btn-speed', () => { ui(); this.startRun('speedrun'); });
    on('btn-lb', () => { ui(); this.openLeaderboard(); });
    on('btn-howto', () => { ui(); this.showScreen('howto'); });
    on('btn-notes', () => { ui(); this.openNotes(); });
    on('btn-settings', () => { ui(); this.settingsFrom = this.screenName; this.showScreen('settings'); });
    ['howto-back', 'lb-back', 'notes-back'].forEach((id) => on(id, () => { ui(); this.showScreen('menu'); }));
    on('settings-back', () => { ui(); this.showScreen(this.settingsFrom === 'pause' ? 'pause' : 'menu'); });
    on('pause-resume', () => { ui(); this.resume(); });
    on('pause-settings', () => { ui(); this.settingsFrom = 'pause'; this.showScreen('settings'); });
    on('pause-quit', () => { this.toMenu(); });
    on('death-retry', () => { this.recordIfNamed(); if (this.mode === 'story') this.retryWard(); else this.startRun(this.mode); });
    on('death-menu', () => { this.recordIfNamed(); this.toMenu(); });
    on('death-save', () => this.record('survival', $('death-name')));
    on('clear-next', () => this.nextLevel());
    on('clear-save', () => this.record(this.mode === 'speedrun' ? 'speedrun' : 'story', $('clear-name')));
    on('clear-menu', () => this.toMenu());
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { this.audio.ui(); this.openLeaderboard(t.dataset.mode); }));
    $('lb-clear').addEventListener('click', () => { if (confirm('Erase all saved scores on this device?')) { this.scores = { survival: [], speedrun: [], story: [] }; store.set('scores', this.scores); this.lastEntry = null; this.openLeaderboard(); } });
    $('death-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.record('survival', $('death-name')); e.stopPropagation(); });
    $('clear-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.record('speedrun', $('clear-name')); e.stopPropagation(); });
    const S = this.settings, save = () => this.applySettings();
    $('opt-volume').addEventListener('input', (e) => { S.volume = +e.target.value; save(); });
    $('opt-brightness').addEventListener('input', (e) => { S.brightness = +e.target.value; save(); });
    $('opt-view').addEventListener('change', (e) => { S.view = e.target.value; save(); });
    $('opt-sens').addEventListener('input', (e) => { S.sens = +e.target.value; save(); });
    $('opt-difficulty').addEventListener('change', (e) => { S.difficulty = e.target.value; save(); });
    $('opt-quality').addEventListener('change', (e) => { S.quality = e.target.value; this.qOverride = null; save(); this.resize(); if (this.view3d) this.view3d.setQuality(S.quality); });
    $('opt-shake').addEventListener('change', (e) => { S.shake = e.target.checked; save(); });
    $('opt-haptics').addEventListener('change', (e) => { S.haptics = e.target.checked; save(); this.vibrate(30); });
    $('opt-fps').addEventListener('change', (e) => { S.fps = e.target.checked; save(); });
    $('btn-mute').addEventListener('click', () => { this.audio.init(); this.audio.setMuted(!this.audio.muted); $('btn-mute').setAttribute('aria-pressed', this.audio.muted); $('btn-mute').textContent = this.audio.muted ? 'Sound off' : 'Sound on'; });
    document.querySelectorAll('.menu button, .btn').forEach((b) => b.addEventListener('mouseenter', () => { if (this.audio.ctx) this.audio.ui(); }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    addEventListener('blur', () => this.pause());
  }
  recordIfNamed() { if (this.mode === 'survival' && this.run && !this.recorded && this.run.score > 0 && $('death-name').value.trim()) this.record('survival', $('death-name'), true); }

  /* ---- input ---- */
  bindInput() {
    this.isTouch = matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('is-touch', this.isTouch);
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && this.state === 'play') e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'play') this.pause(); else if (this.state === 'paused') this.resume();
        else if (this.screenName in BACK_BTN) $(BACK_BTN[this.screenName]).click();
      }
      if (e.code === 'KeyM') $('btn-mute').click();
      if (this.state === 'play') {
        if (e.code === 'KeyQ' || e.code === 'KeyL') this.toggleLight();
        if (e.code === 'KeyF' || e.code === 'Space') this.throwFlare();
        if (e.code === 'KeyE') this.interact();
      }
      if (this.state === 'clear' && (e.code === 'Enter') && !$('clear-next').hidden && this.screenName === 'clear') this.nextLevel();
      if (this.screenName === 'story' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.storyAdvance(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    this.cv.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; });
    addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.has = true; });
    const down = (e) => {
      this.audio.init();
      if (this.state !== 'play') return;
      if (this.use3d && !this.isTouch && !this.locked) { this.lock(); return; }
      if (e.button === 0) this.throwFlare(); else if (e.button === 2) this.toggleLight();
    };
    for (const el of [this.cv, $('stage3d')]) { el.addEventListener('contextmenu', (e) => e.preventDefault()); el.addEventListener('mousedown', down); }
    $('lock-hint').addEventListener('mousedown', down);
    document.addEventListener('pointerlockchange', () => { this.locked = !!document.pointerLockElement; if (this.locked && (this.screenName || this.state !== 'play')) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } return; } if (!this.locked && this.state === 'play' && this.use3d && !this.isTouch) this.pause(); });
    document.addEventListener('mousemove', (e) => { if (this.locked) { this.look.x += e.movementX; this.look.y += e.movementY; } });
    $('story-skip').addEventListener('click', () => this.storyAdvance());
    // touch
    const stick = (zone, knobId, cb) => {
      const el = $(zone), knob = $(knobId); let id = null, ox = 0, oy = 0;
      const set = (e) => { let dx = e.clientX - ox, dy = e.clientY - oy; const m = Math.hypot(dx, dy), max = 46; if (m > max) { dx = dx / m * max; dy = dy / m * max; } knob.style.transform = `translate(${dx}px,${dy}px)`; cb(dx / max, dy / max, true); };
      el.addEventListener('pointerdown', (e) => { this.audio.init(); id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; set(e); e.preventDefault(); });
      el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
      const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; cb(0, 0, false); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    stick('stick-move', 'knob-move', (x, y) => { this.touch.mx = x; this.touch.my = y; });
    stick('stick-aim', 'knob-aim', (x, y, a) => { this.touch.ax = x; this.touch.ay = y; this.touch.aiming = a && Math.hypot(x, y) > 0.2; });
    const btn = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.audio.init(); down(); }); if (up) { el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); } };
    btn('t-run', () => { this.touch.run = true; $('t-run').classList.add('on'); }, () => { this.touch.run = false; $('t-run').classList.remove('on'); });
    btn('t-flare', () => this.throwFlare()); btn('t-light', () => this.toggleLight()); btn('t-use', () => this.interact());
    $('btn-pause-touch').addEventListener('click', () => this.pause());
    addEventListener('gamepadconnected', () => { this.pad = true; });
  }
  readPad() {
    const gp = (navigator.getGamepads && navigator.getGamepads()[0]); if (!gp) return null;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v), b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
    const o = { mx: dz(gp.axes[0] || 0), my: dz(gp.axes[1] || 0), ax: dz(gp.axes[2] || 0), ay: dz(gp.axes[3] || 0), run: b(4) || b(10) || b(6), flare: b(0) || b(7), light: b(2), use: b(3), pause: b(9) };
    const prev = this.padPrev || {}; this.padPrev = o;
    if (o.flare && !prev.flare) this.throwFlare(); if (o.light && !prev.light) this.toggleLight(); if (o.use && !prev.use) this.interact();
    if (o.pause && !prev.pause && this.state === 'play') this.pause();
    return o;
  }
  toggleLight() {
    const P = this.player; if (this.state !== 'play') return;
    if (P.hidden) return;
    if (P.battery <= 0) { this.audio.denied(); this.toast('The battery is dead.'); return; }
    P.lightOn = !P.lightOn; this.audio.click(P.lightOn); this.vibrate(15);
  }
  throwFlare() {
    const P = this.player; if (this.state !== 'play') return;
    if (P.hidden) return;
    if (P.flares <= 0) { this.audio.denied(); this.toast('No flares left.'); return; }
    if (this.flares.length >= 3) { this.audio.denied(); this.toast('Too many flares burning.'); return; }
    P.flares--; this.audio.flare(); P.noiseBoost = 0.8; this.vibrate(25);
    this.flares.push({ x: P.x + Math.cos(P.angle) * 20, y: P.y + Math.sin(P.angle) * 20, vx: Math.cos(P.angle) * 520, vy: Math.sin(P.angle) * 520, life: 28, r: 300, seed: rnd(100) });
  }
  nearLocker() {
    const P = this.player, L = this.level, tx = Math.floor(P.x / TS), ty = Math.floor(P.y / TS);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const X = tx + i, Y = ty + j; if (X < 0 || Y < 0 || X >= L.w || Y >= L.w) continue;
      const idx = Y * L.w + X;
      if (L.tiles[idx] === 2 && L.propKind[idx] === 1 && Math.hypot(P.x - (X + 0.5) * TS, P.y - (Y + 0.5) * TS) < TS * 1.15) return { tx: X, ty: Y };
    }
    return null;
  }
  hide(lk) {
    const P = this.player; P.hidden = true; P.hideTile = lk; P.preX = P.x; P.preY = P.y; P.x = (lk.tx + 0.5) * TS; P.y = (lk.ty + 0.5) * TS; P.vx = P.vy = 0; P.sprint = false;
    this.audio.click(false); this.toast('You pull the door shut. Stay still.', 3);
  }
  unhide() { const P = this.player; if (!P.hidden) return; P.hidden = false; P.x = P.preX; P.y = P.preY; this.audio.click(true); }
  interact() {
    const P = this.player, ex = this.level.exit; if (this.state !== 'play') return;
    if (P.hidden) { this.unhide(); return; }
    if (Math.hypot(P.x - ex.x, P.y - ex.y) < 80) {
      if (this.fuseGot >= this.fuseNeed) { this.completeLevel(); }
      else { this.audio.locked(); this.toast(`The lift needs power: ${this.fuseGot} of ${this.fuseNeed} fuses.`); }
      return;
    }
    const lk = this.nearLocker(); if (lk) this.hide(lk);
  }

  /* ---- loop ---- */
  frame(now) {
    let dt = (now - this.last) / 1000; this.last = now; dt = clamp(dt, 0, 0.05);
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; if (this.settings.fps) $('fps').textContent = Math.round(this.fps) + ' fps'; this.autoQuality(); }
    try { this.update(dt); this.render(); } catch (err) { console.error(err); }
    requestAnimationFrame((t) => this.frame(t));
  }
  autoQuality() {
    if (this.state !== 'play') { this.slow = 0; return; }
    this.slow = this.fps < 34 ? this.slow + 1 : Math.max(0, this.slow - 1);
    const cur = this.qOverride || this.settings.quality;
    if (this.slow >= 6 && cur !== 'low') { this.qOverride = cur === 'high' ? 'medium' : 'low'; this.slow = 0; this.resize(); if (this.view3d) this.view3d.setQuality(this.qOverride); this.toast('Graphics lowered to keep the frame rate up.'); }
  }
  /** Is this point lit by the beam, a flare or a lamp? `near` adds the glow right around the player (not used for the Stalker). */
  isLit(x, y, near = true) {
    const P = this.player, L = this.level;
    for (const f of this.flares) { if (Math.hypot(x - f.x, y - f.y) < f.r * 0.85 && L.los(f.x, f.y, x, y)) return true; }
    for (const m of L.lamps) { if (m.on > 0.5 && Math.hypot(x - m.x, y - m.y) < m.r * 0.8 && L.los(m.x, m.y, x, y)) return true; }
    const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy);
    if (near && d < 52) return true;
    if (P.lightOn && !P.hidden && P.battery > 0 && d < 520 && Math.abs(angDiff(Math.atan2(dy, dx), P.angle)) < 0.5 && L.los(P.x, P.y, x, y)) return true;
    return false;
  }
  onNotice(e) {
    const P = this.player, pan = this.pan(e.x, e.y), v = clamp(1.2 - e.dist / 700, 0.3, 1);
    this.audio.growl(e.type, pan, v); if (e.dist < 400) { this.audio.stinger(); this.cam.shake = Math.max(this.cam.shake, 9); this.glitch = 0.4; this.vibrate([50, 40, 50]); }
    P.sanity = Math.max(0, P.sanity - 4);
    const tips = { wraith: 'A Wraith. It sees you better when your torch is on. Break line of sight, or hide.', crawler: 'A Crawler. Fast, and it hears everything. Fire frightens it: throw a flare.', stalker: 'The Stalker only moves when you can’t see it. Keep your torch on it, or stand in lamp light.' };
    if (tips[e.type]) this.hint('e_' + e.type, tips[e.type]);
  }
  onShriek(h) {
    const P = this.player; this.audio.shriek(this.pan(h.x, h.y), clamp(1.3 - h.dist / 800, 0.4, 1)); this.cam.shake = Math.max(this.cam.shake, 12); this.glitch = 0.8; P.sanity = Math.max(0, P.sanity - 10);
    this.toast('A Howler has screamed. Everything is coming.', 3); this.hint('e_howler', 'A Howler. It never moves, but its scream calls everything to you. Stay out of its sight.');
    for (const e of this.enemies) if ((e.type === 'wraith' || e.type === 'crawler') && e.state !== 'chase') { e.state = 'investigate'; e.goTo(this, Math.floor(P.x / TS), Math.floor(P.y / TS)); e.pause = 0; }
  }

  update(dt) {
    this.time += dt;
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) $('toast').classList.remove('show'); }
    this.cam.shake = Math.max(0, this.cam.shake - dt * 32);
    this.damageFlash = Math.max(0, (this.damageFlash || 0) - dt * 1.8); this.glitch = Math.max(0, (this.glitch || 0) - dt * 1.5);
    this.fade = Math.max(0, this.fade - dt * 0.7);
    const L = this.level, P = this.player;

    if (this.state === 'menu') { this.updateMenu(dt); return; }
    if (this.state === 'paused') return;
    if (this.state === 'dead') { this.deadT += dt; this.stepWorld(dt * 0.3); if (this.deadT > 1.8 && this.screenName !== 'death') this.showDeath(); this.audio.tick(dt, 0, P.sanity, 1); this.followCam(dt); return; }
    if (this.state === 'clear') { this.stepWorld(dt * 0.2); this.followCam(dt); return; }
    if (this.state !== 'play') return;

    this.run.time += dt; this.run.levelTime += dt;
    const pad = this.readPad();
    // aim
    const sx = (P.x - this.cam.x) * this.zoom / this.dpr, sy = (P.y - this.cam.y) * this.zoom / this.dpr;
    if (this.use3d) {
      const sens = 0.0006 + this.settings.sens * 0.000028;
      P.angle += this.look.x * sens; P.pitch = clamp((P.pitch || 0) - this.look.y * sens, -1.0, 1.0); this.look.x = this.look.y = 0;
      if (this.touch.aiming) { P.angle += this.touch.ax * 2.6 * dt; P.pitch = clamp(P.pitch - this.touch.ay * 1.6 * dt, -1, 1); }
      if (pad) { P.angle += pad.ax * 2.8 * dt; P.pitch = clamp(P.pitch - pad.ay * 1.8 * dt, -1, 1); }
      if (P.angle > Math.PI) P.angle -= TAU; else if (P.angle < -Math.PI) P.angle += TAU;
    }
    else if (this.touch.aiming) P.angle = lerpAngle(P.angle, Math.atan2(this.touch.ay, this.touch.ax), Math.min(1, dt * 18));
    else if (pad && Math.hypot(pad.ax, pad.ay) > 0.3) P.angle = lerpAngle(P.angle, Math.atan2(pad.ay, pad.ax), Math.min(1, dt * 14));
    else if (this.isTouch && Math.hypot(this.touch.mx, this.touch.my) > 0.25) P.angle = lerpAngle(P.angle, Math.atan2(this.touch.my, this.touch.mx), Math.min(1, dt * 10));
    else if (this.mouse.has && !this.isTouch) P.angle = lerpAngle(P.angle, Math.atan2(this.mouse.y - sy, this.mouse.x - sx), Math.min(1, dt * 22));
    // move
    const K = this.keys; let mx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0), my = (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0) - (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0);
    mx += this.touch.mx + (pad ? pad.mx : 0); my += this.touch.my + (pad ? pad.my : 0);
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    if (this.use3d && ml > 0) { const c = Math.cos(P.angle), s = Math.sin(P.angle), fw = -my, st = mx; mx = c * fw - s * st; my = s * fw + c * st; } // first person: move relative to where you face
    const moving = ml > 0.1; P.moving = moving;
    const wantRun = (K.has('ShiftLeft') || K.has('ShiftRight') || this.touch.run || (pad && pad.run)) && moving;
    if (P.stamina <= 0) P.exhausted = true; if (P.stamina > 28) P.exhausted = false;
    P.sprint = wantRun && !P.exhausted && !P.hidden;
    P.hideK = lerp(P.hideK || 0, P.hidden ? 1 : 0, Math.min(1, dt * 6));
    P.stamina = clamp(P.stamina + (P.sprint ? -26 : moving ? 12 : 22) * dt, 0, 100);
    const speed = P.sprint ? 238 : 140;
    if (P.hidden) { P.vx = P.vy = 0; } else {
      P.vx = lerp(P.vx, mx * speed, Math.min(1, dt * 11)); P.vy = lerp(P.vy, my * speed, Math.min(1, dt * 11));
      P.x += P.vx * dt; P.y += P.vy * dt; L.collide(P, P.r);
    }
    const sp = Math.hypot(P.vx, P.vy); P.stride += sp * dt; P.bob += sp * dt * 0.1;
    if (P.stride > (P.sprint ? 46 : 62)) { P.stride = 0; this.audio.step(P.sprint); this.particles.push({ x: P.x, y: P.y, vx: rnd(-8, 8), vy: rnd(-8, 8), life: 0.8, max: 0.8, c: 'rgba(120,120,110,', s: rnd(2, 4), f: 0.3 }); }
    P.noiseBoost = Math.max(0, P.noiseBoost - dt);
    P.noise = P.hidden ? 0 : Math.max(P.noiseBoost > 0 ? 260 : 0, sp > 200 ? 330 : sp > 60 ? 150 : 36);

    // light & vitals
    if (P.lightOn && P.battery > 0) { P.battery = Math.max(0, P.battery - dt * 0.5); if (P.battery <= 0) { P.lightOn = false; this.toast('The flashlight died.'); this.audio.click(false); } }
    const unlit = !(P.lightOn && P.battery > 0) || P.hidden;
    let dS = -0.3; if (unlit) dS -= P.hidden ? 0.6 : 1.7;
    const inLamp = L.lamps.some((m) => m.on > 0.5 && Math.hypot(m.x - P.x, m.y - P.y) < m.r * 0.7 && L.los(m.x, m.y, P.x, P.y));
    if (inLamp && dS < 0.8) dS = 0.8;
    const inFlare = this.flares.some((f) => Math.hypot(f.x - P.x, f.y - P.y) < f.r * 0.7);
    if (inFlare) dS = 1.6;
    let nearest = 1e9, chasing = false;
    for (const e of this.enemies) { if (e.dist < nearest && e.type !== 'howler') nearest = e.dist; if (e.state === 'chase') chasing = true; if (e.dist < 260 && e.lit && L.los(e.x, e.y, P.x, P.y) && e.type !== 'stalker') dS -= 2.4; }
    const speedrunFactor = this.mode === 'speedrun' ? 0.6 : 1;
    P.sanity = clamp(P.sanity + dS * dt * (dS < 0 ? speedrunFactor : 1), 0, 100);
    if (P.sanity <= 0) { P.hp -= 3 * dt; this.run.damage += 3 * dt; if (P.hp <= 0) this.die('the dark'); }
    this.threat = clamp(1 - nearest / 600, 0, 1) * (chasing ? 1 : 0.55);
    this.audio.tick(dt, this.threat, P.sanity, P.hp / 100, chasing);
    P.flicker = (!unlit && (P.battery < 18 || P.sanity < 35) && Math.random() < 0.05 + (P.battery < 8 ? 0.1 : 0)) ? rnd(0.08, 0.3) : Math.max(0, P.flicker - dt);

    if (!P.hidden) { this.lastExposed.x = P.x; this.lastExposed.y = P.y; }
    // world
    this.stepWorld(dt);
    this.pressureT -= dt; // the ward keeps hunting: every so often something is sent to where you were
    if (this.pressureT <= 0) {
      this.pressureT = this.pressureEvery;
      const cands = this.enemies.filter((e) => (e.type === 'wraith' || e.type === 'crawler') && e.state !== 'chase');
      if (cands.length) { const e = pick(cands), t = this.pressureTarget(); e.state = 'investigate'; e.goTo(this, t.x, t.y); e.pause = 0; this.audio.creak(this.pan(e.x, e.y)); }
    }
    if (P.battery < 20 && P.battery > 0) this.hint('battery', 'Your torch is dying. Find batteries, or switch it off (Q) in a safe room to save power.');
    if (P.sanity < 40) this.hint('sanity', 'Your mind is fraying. Stand in lamp light, burn a flare, or find pills before it starts to hurt.');
    if (P.hp < 35) this.hint('hp', 'You’re badly hurt. Medkits are the white boxes. Hide, and don’t fight.');
    if (!P.hidden && this.nearLocker()) this.hint('locker', 'Press E beside a locker to hide. Hunters lose you, but they will come and check.');
    if (inLamp) this.hint('lamp', 'Lamp light calms your mind and holds the Stalker back. Failing lamps flicker.');
    const lh = this.use3d && !this.isTouch && !this.locked && this.state === 'play'; if (lh !== this.lastLockHint) { this.lastLockHint = lh; $('lock-hint').hidden = !lh; }
    if (P.hidden) for (const e of this.enemies) {
      if (e.type === 'howler') continue;
      if (e.dist < 64 && (e.type === 'stalker' || e.state === 'search' || e.state === 'investigate' || e.state === 'chase')) {
        e.findT = (e.findT || 0) + dt;
        if (e.findT > 2.4) { e.findT = 0; this.unhide(); this.toast('It found you.'); this.hurt(e.cfg.dmg, e); break; }
      } else e.findT = 0;
    }
    this.fieldT -= dt;
    const ptx = Math.floor(P.x / TS), pty = Math.floor(P.y / TS);
    if (this.fieldT <= 0 || ptx !== this.fieldTx || pty !== this.fieldTy) { if (this.fieldT <= 0) { this.playerField = L.bfs(ptx, pty); this.fieldTx = ptx; this.fieldTy = pty; this.fieldT = 0.3; } }
    L.reveal(P.x, P.y, 5);

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i]; k.t += dt; if (Math.hypot(k.x - P.x, k.y - P.y) > 30) continue;
      const msgs = { battery: ['Battery +40', () => { P.battery = Math.min(100, P.battery + 40); }], medkit: ['Health +35', () => { P.hp = Math.min(100, P.hp + 35); }], pills: ['Sanity +30', () => { P.sanity = Math.min(100, P.sanity + 30); }], flare: ['Flare +1', () => { P.flares = Math.min(5, P.flares + 1); }] };
      if (k.kind === 'note') { this.readNote(k.idx); this.audio.pickup('fuse'); this.addScore(50); this.pickups.splice(i, 1); continue; }
      if ((k.kind === 'medkit' && P.hp >= 100) || (k.kind === 'flare' && P.flares >= 5)) continue;
      msgs[k.kind][1](); this.toast(msgs[k.kind][0]); this.audio.pickup(k.kind); this.addScore(25); this.vibrate(20); this.pickups.splice(i, 1);
    }
    for (const f of this.fuses) {
      f.t += dt; if (f.got || Math.hypot(f.x - P.x, f.y - P.y) > 32) continue;
      f.got = true; this.fuseGot++; this.run.fuses++; this.addScore(150); this.audio.pickup('fuse'); this.vibrate([30, 30, 30]);
      if (this.fuseGot === 1 && this.fuseNeed > 1) { this.storyMsg('mid'); if (this.pressureT > 1e8) this.pressureT = this.pressureEvery; }
      if (this.fuseGot >= this.fuseNeed) { this.toast('All fuses restored. The lift is live. Reach it.', 4); this.audio.powerUp(); this.liftAlarm(); this.hint('lift', 'The lift hums when it has power. Follow the arrow at the top of your screen.'); } else this.toast(`Fuse ${this.fuseGot} of ${this.fuseNeed}`);
    }
    // exit prompt
    const ex = L.exit, nearExit = Math.hypot(P.x - ex.x, P.y - ex.y) < 80;
    let pr = nearExit ? (this.fuseGot >= this.fuseNeed ? (this.isTouch ? 'Tap Use to take the lift' : 'Press E to take the lift') : `The lift has no power · ${this.fuseGot} of ${this.fuseNeed} fuses`) : '';
    if (!pr && !P.hidden && this.nearLocker()) pr = this.isTouch ? 'Tap Use to hide' : 'Press E to hide in the locker';
    if (P.hidden) pr = this.isTouch ? 'Tap Use to come out' : 'Press E to come out';
    this.prompt = pr;
    if (nearExit && this.fuseGot >= this.fuseNeed && Math.hypot(P.x - ex.x, P.y - ex.y) < 30) this.completeLevel();

    this.followCam(dt);
    this.updateHud();
  }
  updateMenu(dt) {
    const P = this.player, L = this.level;
    this.stepWorld(dt);
    // sweep the beam slowly; follow pointer when present
    const sx = this.cv.width / this.dpr * 0.62, sy = this.cv.height / this.dpr * 0.5;
    if (this.mouse.has) P.angle = lerpAngle(P.angle, Math.atan2(this.mouse.y - sy, this.mouse.x - sx), Math.min(1, dt * 4));
    else P.angle += dt * 0.25;
    P.lightOn = true; P.battery = 100; P.sanity = 100; P.noise = 0;
    this.cam.x = lerp(this.cam.x, P.x - this.cv.width / this.zoom * 0.62, 0.05); this.cam.y = lerp(this.cam.y, P.y - this.cv.height / this.zoom / 2, 0.05);
    L.reveal(P.x, P.y, 3);
  }
  stepWorld(dt) {
    const L = this.level;
    for (const m of L.lamps) m.on = lampIntensity(m, this.time);
    if (this.state === 'play' || this.state === 'menu') { for (const e of this.enemies) e.update(this, dt); }
    else for (const e of this.enemies) e.update(this, dt * 0);
    for (let i = 0; i < this.enemies.length; i++) for (let j = i + 1; j < this.enemies.length; j++) {
      const a = this.enemies[i], b = this.enemies[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d < m && d > 0.01) { const p = (m - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
    for (const f of this.flares) {
      f.life -= dt;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > 4) {
        const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
        if (L.solidAt(nx, f.y)) f.vx *= -0.3; else f.x = nx;
        if (L.solidAt(f.x, ny)) f.vy *= -0.3; else f.y = ny;
        const fr = Math.pow(0.02, dt); f.vx *= fr; f.vy *= fr;
      }
      if (this.state === 'play') for (const e of this.enemies) if (e.type === 'wraith' || e.type === 'crawler') { if (Math.hypot(e.x - f.x, e.y - f.y) < f.r * 0.75 && e.stun <= 0 && L.los(f.x, f.y, e.x, e.y)) { e.stun = 2.2; e.state = 'patrol'; e.pickPatrol(this); } }
      if (Math.random() < dt * 40) this.particles.push({ x: f.x + rnd(-3, 3), y: f.y + rnd(-3, 3), vx: rnd(-30, 30), vy: rnd(-60, -10), life: rnd(0.3, 0.8), max: 0.8, c: 'rgba(255,150,60,', s: rnd(1, 2.4), f: 0 });
      if (f.life < 4) f.r = f.r * 0.998;
    }
    this.flares = this.flares.filter((f) => f.life > 0);
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.f) { const k = Math.pow(0.1, dt); p.vx *= k; p.vy *= k; } if (p.life <= 0) this.particles.splice(i, 1); }
    if (this.particles.length > 400) this.particles.splice(0, 100);
    // drifting dust motes near the camera
    if (this.particles.length < 260 && Math.random() < dt * 40) this.particles.push({ x: this.cam.x + Math.random() * this.cv.width / this.zoom, y: this.cam.y + Math.random() * this.cv.height / this.zoom, vx: rnd(-6, 6), vy: rnd(-6, 6), life: rnd(3, 7), max: 7, c: 'rgba(230,220,190,', s: rnd(0.8, 1.6), f: 0, dust: true });
    // hallucinations
    const P = this.player;
    if (this.state === 'play' && P.sanity < 45) {
      this.hallT = (this.hallT || 5) - dt;
      if (this.hallT <= 0) {
        this.hallT = rnd(5, 11) * (P.sanity / 45 + 0.4);
        const a = P.angle + rnd(-0.3, 0.3), d = rnd(200, 360);
        const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
        if (!L.solidAt(x, y) && L.los(P.x, P.y, x, y)) { this.halluc.push({ x, y, life: 2.6, type: pick(['wraith', 'crawler']), angle: a + Math.PI }); this.audio.whisper(this.pan(x, y)); this.glitch = 0.5; }
      }
    }
    for (const h of this.halluc) { h.life -= dt; if (this.isLit(h.x, h.y) && Math.hypot(h.x - P.x, h.y - P.y) < 220) h.life = Math.min(h.life, 0.15); }
    this.halluc = this.halluc.filter((h) => h.life > 0);
  }
  followCam(dt) {
    const P = this.player, W = this.cv.width / this.zoom, H = this.cv.height / this.zoom;
    const look = this.state === 'play' ? 70 : 0;
    const tx = P.x + Math.cos(P.angle) * look - W / 2, ty = P.y + Math.sin(P.angle) * look - H / 2;
    this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 6)); this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 6));
  }
  updateHud() {
    const P = this.player, h = this.lastHud, set = (k, v, fn) => { if (h[k] !== v) { h[k] = v; fn(v); } };
    set('hp', Math.ceil(P.hp), (v) => { $('bar-hp').style.width = clamp(v, 0, 100) + '%'; $('val-hp').textContent = v; $('g-hp').classList.toggle('crit', v <= 30); });
    set('san', Math.ceil(P.sanity), (v) => { $('bar-san').style.width = v + '%'; $('val-san').textContent = v > 70 ? 'Steady' : v > 40 ? 'Uneasy' : v > 15 ? 'Fraying' : 'Gone'; $('g-san').classList.toggle('crit', v <= 25); });
    set('bat', Math.ceil(P.battery), (v) => { $('bar-bat').style.width = v + '%'; $('val-bat').textContent = v + '%'; $('g-bat').classList.toggle('crit', v <= 15); });
    set('sta', Math.round(P.stamina / 4), (v) => { $('bar-sta').style.width = clamp(v * 4, 0, 100) + '%'; });
    set('fl', P.flares, (v) => { $('val-flares').textContent = v; });
    set('fu', this.fuseGot + '/' + this.fuseNeed, (v) => { $('val-fuses').textContent = v; $('obj').classList.toggle('done', this.fuseGot >= this.fuseNeed); $('obj-text').textContent = this.fuseGot >= this.fuseNeed ? 'Take the lift' : 'Fuses restored'; });
    const sr = this.mode === 'speedrun';
    set('tm', sr ? Math.floor(this.run.time * 20) : Math.floor(this.run.time), () => { $('hud-time').textContent = sr ? fmtTimeMs(this.run.time) : fmtTime(this.run.time); });
    set('sc', this.run.score, (v) => { $('hud-score').textContent = v; });
    set('pr', this.prompt, (v) => { const p = $('prompt'); p.textContent = v; p.classList.toggle('show', !!v); });
    set('lt', P.lightOn && P.battery > 0, (v) => { $('t-light').classList.toggle('on', v); });
    const cp = $('compass'), live = this.fuseGot >= this.fuseNeed;
    if (cp.hidden === live) cp.hidden = !live;
    if (live) { const ex = this.level.exit, a = Math.atan2(ex.y - P.y, ex.x - P.x), rot = this.use3d ? a - P.angle : a + Math.PI / 2; cp.firstElementChild.style.transform = `rotate(${rot}rad)`; const m = Math.round(Math.hypot(ex.x - P.x, ex.y - P.y) / TS * 3); if (h.cm !== m) { h.cm = m; $('compass-dist').textContent = m + ' m'; } }
    this.mapT = (this.mapT || 0) - 1; if (this.mapT <= 0) { this.mapT = 6; this.drawMap(); }
  }
  drawMap() {
    const c = $('minimap'), g = c.getContext('2d'), L = this.level, P = this.player, S = 3, R = Math.floor(c.width / S / 2);
    g.clearRect(0, 0, c.width, c.height);
    const ptx = Math.floor(P.x / TS), pty = Math.floor(P.y / TS);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const X = ptx + i, Y = pty + j; if (X < 0 || Y < 0 || X >= L.w || Y >= L.w) continue;
      const idx = Y * L.w + X; if (!L.explored[idx] || L.tiles[idx] === 0) continue;
      g.fillStyle = L.tiles[idx] === 2 ? 'rgba(150,130,100,.5)' : 'rgba(217,210,186,.28)'; g.fillRect((i + R) * S, (j + R) * S, S, S);
    }
    const mark = (x, y, col, sz) => { const i = Math.floor(x / TS) - ptx, j = Math.floor(y / TS) - pty; if (Math.abs(i) > R || Math.abs(j) > R) return; if (!L.explored[Math.floor(y / TS) * L.w + Math.floor(x / TS)]) return; g.fillStyle = col; g.fillRect((i + R) * S - 1, (j + R) * S - 1, sz, sz); };
    mark(L.exit.x, L.exit.y, this.fuseGot >= this.fuseNeed ? '#6fe0a0' : '#b5303a', 6);
    for (const f of this.fuses) if (!f.got) mark(f.x, f.y, '#f2c46d', 4);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * S + S / 2, R * S + S / 2, 3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(R * S + S / 2, R * S + S / 2); g.lineTo(R * S + S / 2 + Math.cos(P.angle) * 9, R * S + S / 2 + Math.sin(P.angle) * 9); g.stroke();
  }

  /* ---- render ---- */
  render() {
    if (this.use3d && this.view3d && this.state !== 'menu') {
      try { this.view3d.render(); this.fail3d = 0; }
      catch (err) { console.error(err); if (++this.fail3d > 5) { this.use3d = false; document.body.classList.remove('mode3d'); this.toast('3D view failed. Switched to top-down.'); } }
      return;
    }
    const c = this.ctx, W = this.cv.width, H = this.cv.height, z = this.zoom, L = this.level, P = this.player, S = this.sprites;
    if (!L) return;
    const sh = this.settings.shake ? this.cam.shake : 0;
    const cx = this.cam.x + rnd(-sh, sh) / z * 0.6, cy = this.cam.y + rnd(-sh, sh) / z * 0.6;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#020304'; c.fillRect(0, 0, W, H);
    c.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    const x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS)), x1 = Math.min(L.w - 1, Math.floor((cx + W / z) / TS)), y1 = Math.min(L.w - 1, Math.floor((cy + H / z) / TS));
    const T = L.tiles, Wd = L.w;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * Wd + x, t = T[i];
      if (t === 0) continue;
      const room = L.roomAt[i], kind = room >= 0 ? L.rooms[room].kind : 4, v = ((x * 73856093) ^ (y * 19349663)) >>> 0 & 3;
      c.drawImage(S.floor[kind][v], x * TS, y * TS, TS + 1, TS + 1);
      if (t === 1) {
        if (L.tiles[i - Wd] !== 1 && y > 0) c.drawImage(S.ao.n, x * TS, y * TS);
        if (y < Wd - 1 && L.tiles[i + Wd] !== 1) c.drawImage(S.ao.s, x * TS, y * TS + TS - 16);
        if (x > 0 && L.tiles[i - 1] !== 1) c.drawImage(S.ao.w, x * TS, y * TS);
        if (x < Wd - 1 && L.tiles[i + 1] !== 1) c.drawImage(S.ao.e, x * TS + TS - 16, y * TS);
      }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * Wd + x, t = T[i];
      if (t === 0) {
        // skip wall tiles that touch no floor (solid mass) – paint flat
        const edge = (x > 0 && T[i - 1] === 1) || (x < Wd - 1 && T[i + 1] === 1) || (y > 0 && T[i - Wd] === 1) || (y < Wd - 1 && T[i + Wd] === 1) || (x > 0 && y > 0 && T[i - Wd - 1] === 1) || (x < Wd - 1 && y > 0 && T[i - Wd + 1] === 1) || (x > 0 && y < Wd - 1 && T[i + Wd - 1] === 1) || (x < Wd - 1 && y < Wd - 1 && T[i + Wd + 1] === 1);
        if (!edge) { c.fillStyle = '#0b0c0d'; c.fillRect(x * TS, y * TS, TS + 1, TS + 1); continue; }
        c.drawImage(S.wall[((x * 31) ^ (y * 17)) & 3], x * TS, y * TS, TS + 1, TS + 1);
        c.fillStyle = 'rgba(190,200,205,.22)';
        if (y < Wd - 1 && T[i + Wd] !== 0) c.fillRect(x * TS, y * TS + TS - 3, TS, 3);
        if (y > 0 && T[i - Wd] !== 0) c.fillRect(x * TS, y * TS, TS, 2);
        if (x > 0 && T[i - 1] !== 0) c.fillRect(x * TS, y * TS, 2, TS);
        if (x < Wd - 1 && T[i + 1] !== 0) c.fillRect(x * TS + TS - 2, y * TS, 2, TS);
      } else if (t === 2) c.drawImage(S.props[L.propKind[i]], x * TS, y * TS, TS + 1, TS + 1);
    }

    // exit door
    const ex = L.exit, powered = this.fuseGot >= this.fuseNeed && !this.attract;
    if (!this.attract || true) this.drawExit(c, ex, powered);
    for (const m of L.lamps) { c.fillStyle = '#4a4d48'; c.beginPath(); c.arc(m.x, m.y, 8, 0, TAU); c.fill(); c.fillStyle = `rgba(230,245,210,${(0.3 + m.on * 0.7).toFixed(2)})`; c.beginPath(); c.arc(m.x, m.y, 4.5, 0, TAU); c.fill(); }
    // pickups & fuses
    for (const k of this.pickups) this.drawPickup(c, k);
    for (const f of this.fuses) if (!f.got) this.drawFuse(c, f);
    // flares
    for (const f of this.flares) { c.fillStyle = '#ff5a2a'; c.save(); c.translate(f.x, f.y); c.rotate(f.seed); c.fillRect(-6, -2, 12, 4); c.fillStyle = '#fff4c8'; c.beginPath(); c.arc(6, 0, 3 + Math.sin(this.time * 30 + f.seed) * 0.8, 0, TAU); c.fill(); c.restore(); }
    // enemies
    for (const e of this.enemies) this.drawEnemy(c, e, 1);
    for (const h of this.halluc) this.drawEnemy(c, { type: h.type, x: h.x, y: h.y, angle: h.angle, r: ENEMY[h.type].r, t: this.time, state: 'patrol', vx: 0, vy: 0, stun: 0 }, clamp(h.life, 0, 0.55));
    // player
    if (P.hidden) { c.fillStyle = 'rgba(255,255,225,.85)'; c.fillRect(P.x - 7, P.y - 6, 3, 2); c.fillRect(P.x + 4, P.y - 6, 3, 2); }
    else if (this.state !== 'dead' || this.deadT < 0.2) this.drawPlayer(c, P);
    else { c.fillStyle = 'rgba(90,8,10,.7)'; c.beginPath(); c.ellipse(P.x, P.y, 26, 20, 0, 0, TAU); c.fill(); }
    // particles
    for (const p of this.particles) { const a = clamp(p.life / p.max, 0, 1) * (p.dust ? 0.5 * Math.min(1, (p.max - p.life) * 2) : 0.9); c.fillStyle = p.c + a.toFixed(3) + ')'; c.beginPath(); c.arc(p.x, p.y, p.s, 0, TAU); c.fill(); }

    this.drawLighting(c, cx, cy);

    // glows that read through darkness
    c.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    c.globalCompositeOperation = 'lighter';
    for (const f of this.fuses) if (!f.got) { const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < 700) this.glow(c, f.x, f.y, 34 + Math.sin(f.t * 3) * 6, 'rgba(255,190,80,', 0.5 * (1 - d / 700)); }
    for (const m of L.lamps) this.glow(c, m.x, m.y, 36, 'rgba(190,235,170,', 0.35 * m.on);
    this.glow(c, ex.x, ex.y, 58, powered ? 'rgba(80,255,150,' : 'rgba(255,40,50,', (powered ? 0.5 : 0.3) * (0.8 + Math.sin(this.time * 2.5) * 0.2));
    for (const e of this.enemies) if (e.state === 'chase' && e.type !== 'howler') { const cc = e.type === 'stalker' ? 'rgba(220,240,255,' : 'rgba(255,30,30,'; const ax = Math.cos(e.angle) * 8, ay = Math.sin(e.angle) * 8, px = -ay * 0.9, py = ax * 0.9; this.glow(c, e.x + ax + px, e.y + ay + py, 6, cc, 0.9); this.glow(c, e.x + ax - px, e.y + ay - py, 6, cc, 0.9); }
    for (const e of this.enemies) if (e.type === 'howler') this.glow(c, e.x, e.y, 14, 'rgba(255,40,40,', 0.35 + 0.2 * Math.sin(this.time * 4));
    c.globalCompositeOperation = 'source-over';
    this.drawPost(c, W, H);
  }
  glow(c, x, y, r, col, a) { if (a <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + a.toFixed(3) + ')'); g.addColorStop(1, col + '0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  drawExit(c, ex, powered) {
    c.save(); c.translate(ex.x, ex.y);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(-26, -26, 52, 52);
    c.fillStyle = '#23292b'; c.fillRect(-24, -24, 48, 48);
    c.strokeStyle = powered ? '#4fe08f' : '#6e2128'; c.lineWidth = 3; c.strokeRect(-20, -20, 40, 40);
    c.fillStyle = powered ? 'rgba(70,240,140,.35)' : 'rgba(0,0,0,.4)'; c.fillRect(-17, -17, 34, 34);
    c.fillStyle = powered ? '#4fe08f' : '#8a1117'; c.font = 'bold 13px "Special Elite", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('EXIT', 0, 0);
    c.restore();
  }
  drawPickup(c, k) {
    c.save(); c.translate(k.x, k.y + Math.sin(k.t * 2.4) * 1.5);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(1, 6, 9, 4, 0, 0, TAU); c.fill();
    if (k.kind === 'battery') { c.fillStyle = '#2d2f31'; c.fillRect(-5, -9, 10, 18); c.fillStyle = '#e8b83a'; c.fillRect(-5, -5, 10, 11); c.fillStyle = '#999'; c.fillRect(-2, -11, 4, 3); }
    else if (k.kind === 'medkit') { c.fillStyle = '#e6e2d6'; c.fillRect(-9, -7, 18, 14); c.fillStyle = '#b3202a'; c.fillRect(-2, -5, 4, 10); c.fillRect(-5, -2, 10, 4); }
    else if (k.kind === 'pills') { c.fillStyle = '#d98b2b'; c.fillRect(-5, -8, 10, 16); c.fillStyle = '#f2efe4'; c.fillRect(-5, -9, 10, 4); c.fillStyle = '#fff'; c.fillRect(-3, -2, 6, 5); }
    else if (k.kind === 'note') { c.rotate(0.25); c.fillStyle = '#d9d2ba'; c.fillRect(-7, -9, 14, 18); c.fillStyle = '#6b6451'; for (let i = 0; i < 4; i++) c.fillRect(-4, -5 + i * 4, 8, 1.2); }
    else if (k.kind === 'flare') { c.rotate(-0.6); c.fillStyle = '#b3202a'; c.fillRect(-9, -3, 18, 6); c.fillStyle = '#222'; c.fillRect(-9, -3, 4, 6); }
    c.restore();
  }
  drawFuse(c, f) {
    c.save(); c.translate(f.x, f.y + Math.sin(f.t * 2.2) * 2);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(1, 8, 9, 4, 0, 0, TAU); c.fill();
    c.fillStyle = '#c9a24a'; c.fillRect(-4, -11, 8, 22); c.fillStyle = '#6b5420'; c.fillRect(-4, -11, 8, 4); c.fillRect(-4, 7, 8, 4); c.fillStyle = 'rgba(255,240,180,.6)'; c.fillRect(-2, -6, 2, 12);
    c.restore();
  }
  drawPlayer(c, P) {
    c.save(); c.translate(P.x, P.y);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.ellipse(2, 3, 15, 12, 0, 0, TAU); c.fill();
    c.rotate(P.angle);
    const sw = Math.sin(P.bob) * 3;
    c.fillStyle = '#2e3a44'; c.beginPath(); c.ellipse(0, 0, 8, 14, 0, 0, TAU); c.fill(); // shoulders
    c.fillStyle = '#b79a82'; c.beginPath(); c.arc(11, 7 + sw * 0.3, 3.2, 0, TAU); c.fill(); c.beginPath(); c.arc(11, -7 - sw * 0.3, 3.2, 0, TAU); c.fill(); // hands
    c.fillStyle = '#1b1f22'; c.fillRect(8, 5 + sw * 0.3, 11, 4.5); // torch body
    if (P.lightOn && P.battery > 0) { c.fillStyle = '#fff6d0'; c.fillRect(18, 5.2 + sw * 0.3, 2.5, 4); }
    c.fillStyle = '#4b3a2c'; c.beginPath(); c.arc(0, 0, 7.5, 0, TAU); c.fill(); // hair/head
    c.fillStyle = '#a98a72'; c.beginPath(); c.arc(1.5, 0, 5.4, 0, TAU); c.fill();
    c.restore();
  }
  drawEnemy(c, e, alpha) {
    c.save(); c.globalAlpha = alpha; c.translate(e.x, e.y);
    c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(2, 3, e.r + 3, e.r, 0, 0, TAU); c.fill();
    c.rotate(e.angle); const t = e.t * 6, sp = Math.hypot(e.vx || 0, e.vy || 0) / 60;
    if (e.type === 'wraith') {
      c.fillStyle = 'rgba(8,8,12,.85)'; c.beginPath(); c.moveTo(-8, -15); c.quadraticCurveTo(-34, 0, -8, 15); c.quadraticCurveTo(-18 - Math.sin(t) * 4, 0, -8, -15); c.fill();
      c.fillStyle = '#0d0f14'; c.beginPath(); c.ellipse(0, 0, 10, 17, 0, 0, TAU); c.fill();
      const reach = e.state === 'chase' ? 10 : 4;
      c.strokeStyle = '#7e8a88'; c.lineWidth = 2.5; c.lineCap = 'round';
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(2, s * 14); c.quadraticCurveTo(14, s * (16 + Math.sin(t * 0.7 + s) * 3), 20 + reach, s * 7); c.stroke(); for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(20 + reach, s * 7); c.lineTo(27 + reach, s * 7 + k * 3); c.stroke(); } }
      c.fillStyle = '#c9ccc2'; c.beginPath(); c.ellipse(5, 0, 7, 6.5, 0, 0, TAU); c.fill(); c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(8, -2.5, 1.6, 0, TAU); c.arc(8, 2.5, 1.6, 0, TAU); c.fill(); c.fillRect(9, -1, 3, 2);
    } else if (e.type === 'crawler') {
      c.strokeStyle = '#2a2420'; c.lineWidth = 2.5; c.lineCap = 'round';
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const ph = Math.sin(t * (1.2 + sp) + k * 1.3 * s) * 6; c.beginPath(); c.moveTo(k * 3 - 3, 0); c.lineTo(k * 5 - 5 + ph * 0.4, s * 12); c.lineTo(k * 6 - 4 + ph, s * 20); c.stroke(); }
      c.fillStyle = '#39302a'; c.beginPath(); c.ellipse(-3, 0, 11, 8, 0, 0, TAU); c.fill();
      c.fillStyle = '#5b4a40'; c.beginPath(); c.ellipse(8, 0, 6.5, 5.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#c8b9a0'; c.fillRect(11, -3, 3.5, 1.5); c.fillRect(11, 1.5, 3.5, 1.5);
    } else if (e.type === 'stalker') {
      c.strokeStyle = '#d4d6cf'; c.lineWidth = 3; c.lineCap = 'round';
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, s * 11); c.quadraticCurveTo(14, s * 21, 29, s * 5); c.stroke(); }
      c.fillStyle = '#cfd1c9'; c.beginPath(); c.ellipse(0, 0, 10, 16, 0, 0, TAU); c.fill();
      c.fillStyle = '#eceee6'; c.beginPath(); c.arc(4, 0, 8, 0, TAU); c.fill(); // face-less head
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(4, 0, 8, -0.8, 0.8); c.lineTo(4, 0); c.fill();
    } else if (e.type === 'howler') {
      c.fillStyle = '#16151a'; c.beginPath(); c.ellipse(-2, 0, 14, 22, 0, 0, TAU); c.fill();
      c.strokeStyle = '#4b4b52'; c.lineWidth = 3; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, s * 18); c.quadraticCurveTo(12, s * 30, 20, s * 22); c.stroke(); }
      c.fillStyle = '#8c8a84'; c.beginPath(); c.ellipse(8, 0, 9, 8, 0, 0, TAU); c.fill(); c.fillStyle = '#050505'; c.beginPath(); c.ellipse(13, 0, 4, 2 + (e.shriekCd > 8 ? 4 : 0), 0, 0, TAU); c.fill();
    }
    c.restore();
  }
  drawLighting(c, cx, cy) {
    const L = this.level, P = this.player, z = this.zoom, ls = this.ls, lc = this.lightCv, g = this.lctx, q = this.qual;
    const S = this.settings, dark = clamp(0.955 + (S.brightness - 50) / 50 * 0.04, 0.88, 0.985) - (this.state === 'menu' ? 0.2 : 0);
    const lampOn = P.lightOn && P.battery > 0 && P.flicker <= 0 && !P.hidden;
    const ambR = this.state === 'menu' ? 230 : lampOn ? 150 : 95, rays = Math.max(24, Math.round(72 * q.rays));
    const amb = L.poly(P.x, P.y, 0, TAU, ambR, rays);
    let cone = null; const half = 0.62;
    if (lampOn) cone = L.poly(P.x, P.y, P.angle - half, P.angle + half, 560, Math.round(70 * q.rays));
    const vw = this.cv.width / z, vh = this.cv.height / z;
    const lamps = L.lamps.filter((m) => m.on > 0.12 && Math.abs(m.x - (cx + vw / 2)) < vw / 2 + m.r && Math.abs(m.y - (cy + vh / 2)) < vh / 2 + m.r);
    const fl = this.flares.map((f) => ({ f, pts: L.poly(f.x, f.y, 0, TAU, f.r, Math.round(64 * q.rays)) }));
    const flick = 1 - (this.settings.shake ? Math.random() * 0.04 : 0);

    const paint = (ctx, mode, scale, ox, oy) => {
      ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
      const col = mode === 'cut' ? ['0,0,0'] : null;
      const poly = (pts, center) => { ctx.beginPath(); if (center) ctx.moveTo(P.x, P.y); for (let i = 0; i < pts.length; i += 2) (i === 0 && !center ? ctx.moveTo(pts[i], pts[i + 1]) : ctx.lineTo(pts[i], pts[i + 1])); ctx.closePath(); };
      const rg = (x, y, r, stops, a) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, al]) => gr.addColorStop(o, mode === 'cut' ? `rgba(0,0,0,${(al * a).toFixed(3)})` : `rgba(${stops.tint},${(al * a).toFixed(3)})`)); return gr; };
      // ambient
      ctx.save(); poly(amb, false); ctx.clip();
      const as = [[0, 1], [0.45, 0.7], [1, 0]]; as.tint = '255,170,90';
      ctx.fillStyle = rg(P.x, P.y, ambR, as, mode === 'cut' ? 0.9 * flick : 0.1); ctx.fillRect(P.x - ambR, P.y - ambR, ambR * 2, ambR * 2); ctx.restore();
      // beam
      if (cone) {
        ctx.save(); poly(cone, true); ctx.clip();
        const cs = [[0, 1], [0.4, 0.9], [0.75, 0.5], [1, 0]]; cs.tint = '255,214,150';
        const a = mode === 'cut' ? 0.3 * flick : 0.035;
        for (const h of [0.62, 0.5, 0.4, 0.3, 0.2]) {
          ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.arc(P.x, P.y, 562, P.angle - h, P.angle + h); ctx.closePath();
          ctx.fillStyle = rg(P.x, P.y, 562, cs, a); ctx.fill();
        }
        ctx.restore();
      }
      for (const m of lamps) {
        ctx.save(); poly(L.lampPts(m), false); ctx.clip();
        const ls2 = [[0, 1], [0.5, 0.6], [1, 0]]; ls2.tint = '190,225,170';
        ctx.fillStyle = rg(m.x, m.y, m.r, ls2, mode === 'cut' ? m.on * 0.9 : 0.08 * m.on); ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2); ctx.restore();
      }
      for (const { f, pts } of fl) {
        const fk = (0.82 + Math.sin(this.time * 17 + f.seed) * 0.08 + Math.random() * 0.1) * Math.min(1, f.life / 2);
        ctx.save(); poly(pts, false); ctx.clip();
        const fs = [[0, 1], [0.5, 0.65], [1, 0]]; fs.tint = '255,110,50';
        ctx.fillStyle = rg(f.x, f.y, f.r, fs, mode === 'cut' ? fk : 0.16 * fk); ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); ctx.restore();
      }
    };
    // warm tint on the lit world
    c.save(); c.globalCompositeOperation = 'lighter'; paint(c, 'tint', z, cx, cy); c.restore();
    // darkness mask
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(2,3,5,${dark})`; g.fillRect(0, 0, lc.width, lc.height);
    g.globalCompositeOperation = 'destination-out'; paint(g, 'cut', z * ls, cx, cy); g.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(lc, 0, 0, this.cv.width, this.cv.height);
  }
  drawPost(c, W, H) {
    const P = this.player;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const vs = 0.9 + (1 - P.sanity / 100) * 0.1;
    c.globalAlpha = vs; c.drawImage(this.sprites.vignette, 0, 0, W, H); c.globalAlpha = 1;
    // film grain
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.07 + (1 - P.sanity / 100) * 0.07;
    const gr = this.sprites.grain[(this.time * 24 | 0) & 3], ox = (Math.random() * 160) | 0, oy = (Math.random() * 160) | 0;
    for (let y = -oy; y < H; y += 160) for (let x = -ox; x < W; x += 160) c.drawImage(gr, x, y);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    // sanity: glitch bands + desaturate
    const san = P.sanity / 100;
    if (this.settings.shake && this.state !== 'menu' && (this.glitch > 0.05 || (san < 0.4 && Math.random() < 0.06))) {
      const n = 2 + ((this.glitch || 0) * 6 | 0);
      for (let i = 0; i < n; i++) { const y = Math.random() * H, h = 4 + Math.random() * 28, o = (Math.random() - 0.5) * 36 * (this.glitch + 0.3); c.drawImage(this.cv, 0, y, W, h, o, y, W, h); }
    }
    // damage / low health
    const lowHp = P.hp < 40 ? (40 - P.hp) / 40 : 0, pulse = 0.5 + 0.5 * Math.sin(this.time * (3 + lowHp * 3));
    const redA = Math.max(this.damageFlash * 0.55, lowHp * 0.28 * pulse);
    if (redA > 0.01 && this.state !== 'menu') { const g = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(150,0,6,${redA.toFixed(3)})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    if (this.fade > 0) { c.fillStyle = `rgba(0,0,0,${clamp(this.fade, 0, 1)})`; c.fillRect(0, 0, W, H); }
    if (this.state === 'dead') { c.fillStyle = `rgba(0,0,0,${clamp(this.deadT / 1.8, 0, 0.75)})`; c.fillRect(0, 0, W, H); }
    // sanity drains the colour out of the picture (done in-canvas; a CSS filter on a fullscreen canvas is slow on phones)
    if (this.state === 'play' && san < 0.7) { c.globalCompositeOperation = 'saturation'; c.globalAlpha = (0.7 - san) * 0.9; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    if (P.hideK > 0.01) { const bh = H * 0.3 * P.hideK; c.fillStyle = 'rgba(0,0,0,.92)'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh); }
  }
}

const BACK_BTN = { settings: 'settings-back', howto: 'howto-back', leaderboard: 'lb-back', notes: 'notes-back' };
function fmtDate(t) { const d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

/* ───────────────────────────── boot ───────────────────────────── */
function boot() {
  // PWA install: Chromium fires beforeinstallprompt; iOS Safari has no prompt, so show instructions instead.
  let deferred = null; const inst = $('btn-install');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; if (!standalone) inst.hidden = false; });
  addEventListener('appinstalled', () => { inst.hidden = true; deferred = null; });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) inst.hidden = false;
  inst.addEventListener('click', async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; inst.hidden = true; }
    else alert('To install: tap the Share button, then “Add to Home Screen”.');
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  const bar = $('load-bar'); bar.style.width = '40%';
  const start = async () => {
    bar.style.width = '100%';
    const game = window.__game = new Game();
    setTimeout(() => { $('loading').classList.add('done'); }, 350);
    const q = new URLSearchParams(location.search), demo = q.get('demo');
    if (q.get('mode') === 'speedrun') $('btn-speed').focus(); // manifest shortcut targets
    if (demo) { // developer shortcuts used for screenshots/testing
      $('loading').style.display = 'none';
      game.mouse = { x: innerWidth * 0.8, y: innerHeight * 0.35, has: true };
      if (demo === 'play') { await game.startRun('survival'); game.fade = 0; }
      else if (demo === 'dark') { await game.startRun('survival'); game.fade = 0; game.player.sanity = 25; game.player.hp = 35; }
      else if (demo === 'clear') { await game.startRun('survival'); game.fade = 0; game.fuseGot = game.fuseNeed; game.completeLevel(); }
      else if (demo === 'death') { await game.startRun('survival'); game.run.score = 1200; game.player.hp = 1; game.hurt(50, { x: game.player.x, y: game.player.y, cfg: ENEMY.wraith }); game.deadT = 2; game.showDeath(); }
      else if (['settings', 'howto', 'leaderboard'].includes(demo)) { if (demo === 'leaderboard') { game.scores.survival = [{ name: 'Ada', score: 5400, level: 7, time: 800, date: Date.now() }, { name: 'Kell', score: 3100, level: 5, time: 500, date: Date.now() }]; game.openLeaderboard('survival'); } else game.showScreen(demo); }
    }
  };
  start(); // fonts use font-display: swap, so nothing needs to block start-up
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
