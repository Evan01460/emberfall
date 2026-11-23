// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// BOSS MECHANICS — bosses that do more than swing and shoot.
//
// A boss runs a script on top of its ordinary attacks. The script casts PATTERNS: each one fills the floor with HAZARDS that are shown to the
// players before they hurt (a warning phase), then become dangerous (an active phase). Patterns are different puzzles to read and dodge:
//   wheel     rotating beams that sweep the arena            rings     expanding shockwaves to roll through
//   nova      a ring of damage with a safe centre (and a     orbs      orbs that circle the boss, then fly at you
//             second, inverted one after it)                 lanes     lines aimed at every player, striking one by one
//   spots     everywhere hurts except the circles that       rain      falling meteors, some aimed at you
//             light up - run into one                        blades    the boss blinks beside you and cuts three times
//   grid      a floor of tiles, half of them about to hurt   closing   the safe ground shrinks
//   walls     walls of damage sweeping across with a gap
// How many patterns a boss knows, how fast it casts them and how long the warnings are depend on its level and on its health: a boss that
// falls below two thirds and one third of its health learns new patterns and combines them. The element (from the boss's colour) only
// changes how everything looks. Hazards always leave somewhere safe to stand, and they use the same damage formula as ordinary monster
// attacks, so gear and defence work the same against them.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { ENEMIES } from '../data.js';
import { dist } from '../world.js';
import { mobHit } from '../units.js';

const MOB_DMG = 1.3, TAU = Math.PI * 2;
const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export const ELEMENTS = ['fire', 'ice', 'void', 'storm', 'earth', 'poison', 'holy'];
export const ELEMENT_COLOR = { fire: '#ff7a3a', ice: '#8ad8ff', void: '#b070ff', storm: '#ffe04a', earth: '#c8a060', poison: '#7aff6a', holy: '#fff0a0' };
// the boss's colour decides its element
export function elementOf(color = '#888888') {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color); if (!m) return 'earth';
  const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.12) return mx > 0.75 ? 'holy' : 'earth';
  let hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hu = (hu * 60 + 360) % 360;
  return hu < 20 || hu >= 340 ? 'fire' : hu < 45 ? (mx > 0.85 ? 'fire' : 'earth') : hu < 70 ? 'storm' : hu < 165 ? 'poison' : hu < 255 ? 'ice' : 'void';
}
// which patterns each element favours, in the order a boss learns them
const FAVOUR = {
  fire: ['lanes', 'rain', 'rings', 'wheel', 'nova', 'blades'], ice: ['grid', 'walls', 'orbs', 'closing', 'rings', 'spots'], void: ['spots', 'blades', 'orbs', 'wheel', 'nova', 'closing'],
  storm: ['lanes', 'grid', 'walls', 'rain', 'wheel', 'orbs'], earth: ['rings', 'nova', 'grid', 'rain', 'lanes', 'walls'], poison: ['nova', 'orbs', 'closing', 'spots', 'rain', 'wheel'], holy: ['wheel', 'spots', 'walls', 'lanes', 'nova', 'blades'],
};
const NAMES = {
  wheel: ['Wheel of', 'Keep moving - roll through a beam if you must'], rings: ['Shockwaves of', 'Roll through each ring'], nova: ['Nova of', 'Stay out of the ring - then step in'], orbs: ['Orbs of', 'Dodge the orbs when they fly'],
  lanes: ['Lanes of', 'Step out of the lines'], spots: ['Sanctuary of', 'Run into a lit circle'], rain: ['Rain of', 'Keep moving - some are aimed at you'], blades: ['Blink and cut:', 'Move out of each cut'], grid: ['Floor of', 'Stand on a safe tile'],
  closing: ['Closing', 'Stay inside the circle'], walls: ['Walls of', 'Find the gap or roll through'],
};
const EL_NAME = { fire: 'Fire', ice: 'Frost', void: 'the Void', storm: 'Storm', earth: 'Stone', poison: 'Blight', holy: 'Light' };

// Per-boss plan: its element, difficulty (0..1 from its level) and the patterns it knows. Deterministic from its key.
export function planFor(key, level) {
  const info = ENEMIES[key] ?? {}, el = info.el ?? elementOf(info.color), d = clamp((level - 1) / 99, 0, 1), fav = FAVOUR[el], h = hash(key), start = h % 2;
  const n = level < 12 ? 2 : level < 30 ? 3 : level < 55 ? 4 : 5, pats = []; for (let i = 0; pats.length < n && i < fav.length * 2; i++) { const p = fav[(start + i) % fav.length]; if (!pats.includes(p)) pats.push(p); }
  return { el, d, pats, phase: 1, next: 0, busy: 0, last: null, said: false };
}

// ─── geometry ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const beamHit = (ox, oy, a, len, w, px, py) => { const dx = px - ox, dy = py - oy, c = Math.cos(a), s = Math.sin(a), al = dx * c + dy * s, pe = -dx * s + dy * c; return al >= -0.2 && al <= len && Math.abs(pe) <= w / 2 + 0.25; };
export function hazHits(hz, px, py, now) {
  const t = (now - hz.ws) / 1000;
  switch (hz.k) {
    case 'circle': return dist(px, py, hz.x, hz.y) <= hz.r + 0.25;
    case 'donut': { const d = dist(px, py, hz.x, hz.y); return d >= hz.r0 - 0.1 && d <= hz.r + 0.25; }
    case 'beams': { for (let i = 0; i < hz.n; i++) if (beamHit(hz.x, hz.y, hz.a + (i / hz.n) * TAU + hz.spin * t, hz.len, hz.w, px, py)) return true; return false; }
    case 'line': return beamHit(hz.x, hz.y, hz.a, hz.len, hz.w, px, py);
    case 'cone': return dist(px, py, hz.x, hz.y) <= hz.len + 0.25 && (angDiff(ang(hz.x, hz.y, px, py), hz.a) <= hz.arc / 2 || dist(px, py, hz.x, hz.y) < 0.8);
    case 'wall': { const dx = Math.cos(hz.a), dy = Math.sin(hz.a), along = (px - hz.x) * dx + (py - hz.y) * dy - hz.speed * (now - hz.we) / 1000, perp = -(px - hz.x) * dy + (py - hz.y) * dx; return Math.abs(along) <= hz.w / 2 + 0.25 && Math.abs(perp) <= hz.span / 2 && Math.abs(perp - hz.gapAt) > hz.gapW / 2 - 0.15; }
    case 'spots': return !hz.safe.some(([sx, sy, sr]) => dist(px, py, sx, sy) <= sr - 0.2);
    case 'tiles': { const cx = Math.floor((px - hz.x) / hz.size + hz.cols / 2), cy = Math.floor((py - hz.y) / hz.size + hz.rows / 2); return cx >= 0 && cy >= 0 && cx < hz.cols && cy < hz.rows && hz.bad.includes(cy * hz.cols + cx); }
    case 'orb': { const p = orbPos(hz, now); return dist(px, py, p.x, p.y) <= hz.r + 0.3; }
    case 'ring': { const r = hz.speed * (now - hz.we) / 1000; return Math.abs(dist(px, py, hz.x, hz.y) - r) <= hz.w / 2 + 0.3; }
    case 'closing': { const k = clamp((now - hz.we) / (hz.ae - hz.we), 0, 1), r = hz.r + (hz.r1 - hz.r) * k; return dist(px, py, hz.x, hz.y) > r + 0.2; }
    default: return false;
  }
}
export function orbPos(hz, now) {
  const t = (now - hz.ws) / 1000, rel = (hz.we - hz.ws) / 1000;
  if (t <= rel) { const a = hz.a + hz.spin * t; return { x: hz.x + Math.cos(a) * hz.R, y: hz.y + Math.sin(a) * hz.R }; }
  const a0 = hz.a + hz.spin * rel, sx = hz.x + Math.cos(a0) * hz.R, sy = hz.y + Math.sin(a0) * hz.R, run = (t - rel) * hz.speed; return { x: sx + Math.cos(hz.go) * run, y: sy + Math.sin(hz.go) * run };
}

// ─── patterns ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each receives the cast context `c`: { mob, d, ph (phase 1..3), el, nw, add(hz), after(ms, fn), players, aim(), busy(ms) }.
const warnMs = (c, base = 1500) => Math.round(base * (1.18 - 0.38 * c.d) * (c.ph >= 3 ? 0.92 : 1));
export const PATTERNS = {
  wheel(c) {
    const n = 3 + (c.d > 0.5 ? 1 : 0) + (c.ph >= 3 ? 1 : 0), warn = warnMs(c, 1500), act = 4200 + c.ph * 300, spin = (0.5 + 0.3 * c.d) * (c.rng() < 0.5 ? 1 : -1), a0 = c.rng() * TAU;
    c.add({ k: 'beams', x: c.mob.x, y: c.mob.y, a: a0, n, len: 16, w: 1.0 + 0.1 * c.ph, spin, warn, act, pow: 9, tick: 380 }); c.busy(warn + act);
  },
  rings(c) {
    const k = 3 + (c.ph >= 3 ? 1 : 0), gap = 1500 - 250 * c.d, warn = warnMs(c, 1100);
    for (let i = 0; i < k; i++) c.add({ k: 'ring', x: c.mob.x, y: c.mob.y, r: 16, speed: 5.4 + 1.6 * c.d, w: 1.1, warn: warn + i * gap, act: 3600, pow: 21 });
    c.add({ k: 'circle', x: c.mob.x, y: c.mob.y, r: 2.2, warn: warn, act: 0, pow: 0, tell: true }); c.busy(warn + k * gap);
  },
  nova(c) {
    const warn = warnMs(c, 1600), r0 = 3.0 + 0.4 * (c.ph - 1), R = 8 + c.ph;
    c.add({ k: 'donut', x: c.mob.x, y: c.mob.y, r0, r: R, warn, act: 300, pow: 27 }); c.busy(warn + 500);
    if (c.ph >= 2) { const w2 = warnMs(c, 1100); c.add({ k: 'circle', x: c.mob.x, y: c.mob.y, r: r0 + 1.4, warn: w2, act: 300, pow: 25, delay: warn + 450 }); c.busy(warn + 450 + w2 + 600); }
  },
  orbs(c) {
    const n = 4 + c.ph, warn = warnMs(c, 1900), pl = c.players.length ? c.players : [c.mob];
    for (let i = 0; i < n; i++) { const tgt = pl[i % pl.length]; c.add({ k: 'orb', x: c.mob.x, y: c.mob.y, a: (i / n) * TAU, R: 3.6, spin: 1.9, r: 0.6, speed: 7 + 2 * c.d, warn: 0, orbit: warn, act: 2600, pow: 17, tgt: tgt.id, stagger: i * 380 }); }
    c.busy(warn + n * 380);
  },
  lanes(c) {
    const pl = c.players, k = clamp(3 + c.ph + (c.d > 0.5 ? 1 : 0), 3, 7), warn = warnMs(c, 1500);
    for (let i = 0; i < k; i++) { const tgt = pl.length ? pl[i % pl.length] : null, a = tgt ? ang(c.mob.x, c.mob.y, tgt.x, tgt.y) + (i >= pl.length ? (c.rng() - 0.5) * 1.2 : 0) : c.rng() * TAU; c.add({ k: 'line', x: c.mob.x, y: c.mob.y, a, len: 17, w: 2.0, warn: warn + i * 420, act: 260, pow: 25 }); }
    c.busy(warn + k * 420 + 300);
  },
  spots(c) {
    const warn = warnMs(c, 2700), n = Math.max(2, c.players.length + 1), safe = [], sr = Math.max(2.6, 3.5 - 0.3 * c.ph);
    for (let i = 0; i < n; i++) { const a = c.rng() * TAU, d = 2.5 + c.rng() * 6; safe.push([+(c.mob.x + Math.cos(a) * d).toFixed(2), +(c.mob.y + Math.sin(a) * d).toFixed(2), sr]); }
    c.add({ k: 'spots', x: c.mob.x, y: c.mob.y, r: 13, safe, warn, act: 250, pow: 33 }); c.busy(warn + 600);
  },
  rain(c) {
    const n = 9 + 3 * c.ph, over = 3600, base = warnMs(c, 1300);
    for (let i = 0; i < n; i++) { const a = c.rng() * TAU, d = 2 + c.rng() * 10; c.add({ k: 'circle', x: c.mob.x + Math.cos(a) * d, y: c.mob.y + Math.sin(a) * d, r: 1.8, warn: base + (i / n) * over, act: 260, pow: 19 }); }
    c.players.forEach((p, i) => c.add({ k: 'circle', x: p.x, y: p.y, r: 2.0, warn: base + 350 + i * 500, act: 260, pow: 22 })); c.busy(base + over);
  },
  blades(c) {
    const tgt = c.aim(); if (!tgt) return; const warn = warnMs(c, 1000), a = c.rng() * TAU, dx = tgt.x + Math.cos(a) * 3.2, dy = tgt.y + Math.sin(a) * 3.2;
    c.add({ k: 'circle', x: dx, y: dy, r: 1.3, warn, act: 120, pow: 0, tell: true }); c.after(warn, () => { c.teleport(dx, dy); });
    for (let i = 0; i < 3; i++) c.add({ k: 'cone', x: dx, y: dy, a: ang(dx, dy, tgt.x, tgt.y), aimAt: tgt.id, arc: 1.7, len: 4.6, warn: warn + 250 + (i + 1) * 650, act: 160, pow: 22, flip: i });
    c.busy(warn + 2600);
  },
  grid(c) {
    const cols = 5, rows = 5, size = 3.3, checker = c.rng() < 0.5, cells = [], bad = [], bad2 = [], warn = warnMs(c, 2000);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x, b = checker ? (x + y) % 2 === 0 : c.rng() < 0.5; (b ? bad : bad2).push(i); cells.push(i); }
    c.add({ k: 'tiles', x: c.mob.x, y: c.mob.y, cols, rows, size, bad, warn, act: 280, pow: 26 });
    c.add({ k: 'tiles', x: c.mob.x, y: c.mob.y, cols, rows, size, bad: bad2, warn: warn + 1700, act: 280, pow: 26 }); c.busy(warn + 2300);
  },
  walls(c) {
    const warn = warnMs(c, 1500), a = c.rng() * TAU, n = 1 + (c.ph >= 2 ? 1 : 0) + (c.ph >= 3 ? 1 : 0);
    for (let i = 0; i < n; i++) { const dir = a + (i % 2) * Math.PI, ox = c.mob.x - Math.cos(dir) * 13, oy = c.mob.y - Math.sin(dir) * 13; c.add({ k: 'wall', x: ox, y: oy, a: dir, span: 24, w: 1.0, gapAt: (c.rng() - 0.5) * 10, gapW: 4.2 - 0.6 * c.d, speed: 6.2 + 1.5 * c.d, warn: warn + i * 1800, act: 4600, pow: 22 }); }
    c.busy(warn + n * 1800 + 2000);
  },
  closing(c) {
    const warn = warnMs(c, 1700); c.add({ k: 'closing', x: c.mob.x, y: c.mob.y, r: 13, r1: 4.6, warn, act: 6800, pow: 8, tick: 420 }); c.busy(warn + 6800);
  },
};

// ─── the mixin ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const bossMethods = {
  initBosses() { this.haz = []; },

  addHazard(mob, base, plan) {
    const nw = this.now(), ws = nw + (base.delay ?? 0) + (base.stagger ?? 0), lead = base.k === 'orb' ? base.orbit : base.warn, we = ws + lead, act = base.act ?? 300;
    const hz = { id: this.nextEnt++, map: mob.map, owner: mob.id, el: plan.el, ...base, ws, we, ae: we + act, hit: new Set(), next: {} };
    if (hz.k === 'orb') hz.go = hz.a;     // re-aimed at its target until it is let go
    this.haz.push(hz); return hz;
  },
  clearHazards(mobId) { if (this.haz) this.haz = this.haz.filter((h) => h.owner !== mobId); },

  // cast one pattern for `mob`
  castPattern(mob, plan, name, nw) {
    const players = [...this.sessions.values()].filter((S) => S.map === mob.map && !S.dead && dist(S.x, S.y, mob.x, mob.y) < 40), srv = this;
    const c = {
      mob, d: plan.d, ph: plan.phase, el: plan.el, nw, players, rng: Math.random,
      add: (b) => srv.addHazard(mob, b, plan), after: (ms, fn) => srv.timers.push({ at: nw + ms, fn: () => { if (!mob.deadUntil && mob.hp > 0) fn(); } }),
      aim: () => (players.length ? players[Math.floor(c.rng() * players.length)] : null), busy: (ms) => { plan.busy = Math.max(plan.busy, nw + ms); },
      teleport: (x, y) => { this.emit(mob.map, { t: 'dashfx', who: `m${mob.id}`, x: mob.x, y: mob.y }); mob.x = x; mob.y = y; this.emit(mob.map, { t: 'dashfx', who: `m${mob.id}`, x, y }); },
    };
    const [verb, hint] = NAMES[name]; this.emit(mob.map, { t: 'bossmsg', id: mob.id, text: `${verb} ${['closing'].includes(name) ? '' : EL_NAME[plan.el]}`.trim(), hint, el: plan.el });
    PATTERNS[name](c);
  },

  // run from tickMobs for every boss that is fighting
  tickBossScript(mob, nw) {
    if (mob.shadeOf || !mob.boss) return;
    const plan = (mob.bs ??= planFor(mob.key, mob.level)); if (!plan.next) plan.next = nw + 3500;
    const near = [...this.sessions.values()].some((S) => S.map === mob.map && !S.dead && dist(S.x, S.y, mob.x, mob.y) < 30);
    if (!near || !mob.target) { plan.next = Math.max(plan.next, nw + 1500); return; }
    const ratio = mob.hp / mob.maxHp, ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (ph > plan.phase) { plan.phase = ph; plan.next = nw + 1800; this.emit(mob.map, { t: 'bossmsg', id: mob.id, text: ph === 2 ? 'The boss grows desperate' : 'The boss is enraged', hint: 'New patterns - they will overlap now', el: plan.el, big: 1 }); this.emit(mob.map, { t: 'aura', x: mob.x, y: mob.y, r: 4, c: 'rage' }); }
    if (mob.wind || mob.dash || nw < plan.busy || nw < plan.next) return;
    const avail = plan.pats.slice(0, Math.min(plan.pats.length, 1 + plan.phase + (plan.d > 0.3 ? 1 : 0))), choices = avail.filter((p) => p !== plan.last), name = choices[Math.floor(Math.random() * choices.length)] ?? avail[0];
    plan.last = name; this.castPattern(mob, plan, name, nw);
    const gap = (6200 - 2600 * plan.d) * (plan.phase === 1 ? 1 : plan.phase === 2 ? 0.85 : 0.7); plan.next = Math.max(plan.busy, nw) + gap * 0.55;
    // in the last phase a second pattern sometimes starts while the first is still going
    if (plan.phase >= 3 && Math.random() < 0.35 && !['closing', 'blades'].includes(name)) { const other = avail.find((p) => p !== name && !['closing', 'blades'].includes(p)); if (other) this.timers.push({ at: nw + 1300, fn: () => { if (!mob.deadUntil && mob.hp > 0) this.castPattern(mob, plan, other, this.now()); } }); }
  },

  // advance hazards and hurt players standing in the dangerous ones
  tickHazards(nw) {
    if (!this.haz?.length) return;
    const keep = [];
    for (const hz of this.haz) {
      if (nw >= hz.ae) continue;
      const mob = this.mobs.find((m) => m.id === hz.owner); if (!mob || mob.deadUntil || mob.hp <= 0) continue;
      if (!this.anyoneOn(hz.map)) continue;
      if (hz.k === 'cone' && hz.aimAt !== undefined && !hz.locked && nw >= hz.ws + hz.warn * 0.4) { const t = this.sessions.get(hz.aimAt); if (t && t.map === hz.map) hz.a = ang(hz.x, hz.y, t.x, t.y); }   // the cut turns to follow you, then locks in
      if (hz.k === 'cone' && nw >= hz.we - 150) hz.locked = true;
      if (hz.k === 'orb' && nw < hz.we) { const t = this.sessions.get(hz.tgt); if (t && t.map === hz.map && !t.dead) { const p = orbPos(hz, nw); hz.go = ang(p.x, p.y, t.x, t.y); } }
      if (nw >= hz.we && hz.pow > 0) {
        const pw = hz.pow * (ENEMIES[mob.key]?.pwr ?? 1);
        for (const S of this.sessions.values()) {
          if (S.map !== hz.map || S.dead) continue;
          if (hz.k === 'cone' && !hz.locked) continue;
          if (hz.tick) { if ((hz.next[S.id] ?? 0) > nw) continue; } else if (hz.hit.has(S.id)) continue;
          if (!hazHits(hz, S.x, S.y, nw)) continue;
          if (hz.tick) hz.next[S.id] = nw + hz.tick; else hz.hit.add(S.id);
          this.hurtPlayer(S, Math.round(mobHit(pw, mob.atk, S.rt.def) * MOB_DMG * this.gapMult(mob, S)), { mob });
        }
      }
      keep.push(hz);
    }
    this.haz = keep;
  },

  hazardsView(mapId) {
    return this.haz.filter((h) => h.map === mapId).map((h) => {
      const o = { id: h.id, k: h.k, el: h.el, x: +h.x.toFixed(2), y: +h.y.toFixed(2), ws: h.ws, we: h.we, ae: h.ae, tl: h.tell ? 1 : 0 };
      for (const f of ['a', 'r', 'r0', 'r1', 'len', 'w', 'arc', 'n', 'spin', 'speed', 'span', 'gapAt', 'gapW', 'cols', 'rows', 'size', 'bad', 'safe', 'R', 'go']) if (h[f] !== undefined) o[f] = typeof h[f] === 'number' ? +h[f].toFixed(3) : h[f];
      return o;
    });
  },
};
