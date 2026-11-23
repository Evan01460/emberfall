// Real-time world renderer + input. Everything on screen is pixel art on one shared art-pixel grid.
import { G } from './state.js';
import { getMap, T, TS, stepMove, PLAYER_SPEED, dist } from '../world.js';
import { CLASSES, ENEMIES, NODE_TYPES, SKILLS, BASICS } from '../data.js';
import { loadoutOf, basicOf } from '../loadout.js';
import { dayPhase } from '../world.js';
import { sfx, toggleMute } from './sfx.js';
import { toggleMusic } from './music.js';
import { toast } from '../ui-lib.js';
import { listen } from './listeners.js';
import { actionFor } from './keys.js';
import { drawBadge, drawTitle, TITLE_COL } from './badges.js';
import { titleInfo } from '../rules.js';
import { C, q, blit, flipped, drawText, drawTag, cellAt, pdisc, pring, pline, prect, vignette, hex } from './px.js';
import { groundTile, wallSprite, doorSprite, treeSprite, rockSprite, crystalSprite, shelfSprite, prop, nodeSprite, personSprite, monsterSprite, shadowSprite, PAL } from './sprites.js';
import { uiIcon } from './icons.js';
import { navTarget } from './worldmap.js';
import { drawHazards } from './hazards.js';
import { casts, drawGround, drawAir, drawNumbers, drawWork, drawSwing, hooks, ingest } from './fx.js';

const NPC_COLORS = { vendor: '#8a5a2b', lore: '#3d5a8a', tavern: '#8a3d3d', hidden: '#6a3d8a' };
const NPC_CLS = (id) => (id.includes('vendor') ? 'merchant' : id.includes('warden') ? 'warrior' : id.includes('innkeeper') ? 'blacksmith' : id.includes('keeper') ? 'archivist' : id.includes('broker') ? 'broker' : id.includes('brew') ? 'alchemist' : id.includes('stranger') ? 'desperado' : 'warrior');
const flipCache = new WeakMap();
const SEARCHABLE = { barrel: 'Barrel (search)', crates: 'Crates (search)', bookshelf: 'Bookshelf (search)', coalbin: 'Coal bin (search)', herbs: 'Herb rack (gather)', potions: 'Potion shelf (search)', cart: 'Old cart (search)', rack: 'Weapon rack (search)', grave: 'Grave (search)', well: 'Well (drink)', bench: 'Bench (rest)', fountain: 'Fountain (toss a coin)' };
const nightLevel = (p) => (p >= 0.5 && p < 0.95 ? 1 : p >= 0.4 && p < 0.5 ? (p - 0.4) * 10 : p >= 0.95 ? 1 - (p - 0.95) * 10 : Math.max(0, 0.5 - p * 10));
export const weatherOf = (m, now) => { if (m.theme === 'snow') return 'snow'; if (m.theme === 'volcano') return 'ember'; if (m.theme === 'swamp') return 'rain'; if (m.theme !== 'main' || m.id === 'archive' || m.id === 'raid_bastion' || m.id === 'root_cellar' || m.id === 'sunken_vault') return null; const k = Math.sin(now / 140000 + (m.id.length * 1.7)) + Math.sin(now / 53000 + m.w) * 0.6; return k > 1.0 ? 'rain' : null; };
const flip = (spr) => { let f = flipCache.get(spr); if (!f) { f = flipped(spr); flipCache.set(spr, f); } return f; };
const solidKinds = new Set(['forge', 'cauldron', 'exchange', 'camp', 'bazaar', 'gate', 'chest']);

export class WorldView {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.keys = {}; this.cam = { x: 0, y: 0 }; this.Z = 2; this.zoom = 2; this.dpr = 1;
    this.mapId = null; this.map = null; this.mini = null; this.t = 0; this.dt = 0.016; this.doors = new Map();
    this.lastSent = 0; this.lastSentState = ''; this.mouse = { x: 0, y: 0 }; this.mouseDown = false; this.touchAtk = false;
    this.aim = 0; this.cursor = { x: 0, y: 0 }; this.dash = null; this.mouseSeen = false;
    this.motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 0.6 + 0.2, p: Math.random() * 6 }));
    this.prompt = null; this.onPrompt = () => {}; this.onClickPlayer = () => {}; this.flash = 0; this.shake = 0; this.hurtFlash = 0;
    this.resize();
    listen(window, 'resize', () => this.resize());
    listen(window, 'keydown', (e) => this.key(e, true)); listen(window, 'keyup', (e) => this.key(e, false));
    listen(window, 'blur', () => { this.keys = {}; this.mouseDown = false; });
    // Track the pointer over the whole window (HUD panels sit on top of the canvas), in the capture phase so nothing can swallow it.
    // There is no auto-aim: every attack and skill goes toward the cursor (until the pointer has been seen, toward where you face).
    const track = (e) => { const r = canvas.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; this.mouseSeen = true; };
    for (const ev of ['pointermove', 'mousemove', 'pointerdown', 'mousedown']) listen(window, ev, track, { capture: true, passive: true });
    canvas.addEventListener('mousedown', (e) => this.click(e));
    listen(window, 'mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.style.cursor = 'crosshair';
  }
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.round(this.cv.clientWidth * this.dpr); this.cv.height = Math.round(this.cv.clientHeight * this.dpr);
    this.Z = Math.max(1, Math.floor(Math.min(this.cv.width / (TS * 20), this.cv.height / (TS * 11.5))));   // INTEGER pixel scale
    this.zoom = this.Z / this.dpr;
  }
  get vw() { return this.cv.width / this.Z; }
  get vh() { return this.cv.height / this.Z; }
  setMap(id) {
    this.mapId = id; this.map = getMap(id); this.doors.clear();
    { const L = [], R = { lamp: 100, campfire: 84, furnace: 64, fireplace: 64, window: 46, fountain: 40, obelisk: 50 }; for (const d of this.map.decor) if (R[d.kind]) L.push({ x: (d.x + (d.w ?? 1) / 2) * TS, y: (d.y + 0.5) * TS, r: R[d.kind], w: d.kind === 'window' }); for (const p of this.map.points) if (['camp', 'waystone', 'forge', 'cauldron', 'exchange', 'board'].includes(p.kind)) L.push({ x: p.x * TS, y: p.y * TS, r: p.kind === 'waystone' ? 80 : 60 }); this.lights = L; }
    const m = this.map, c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
    const g = c.getContext('2d'), P = PAL[m.theme], H = (a) => hex(a[0]);
    const col = { [T.GRASS]: H(P.grass), [T.PATH]: H(P.path), [T.WATER]: H(P.water), [T.TREE]: [30, 70, 40], [T.ROCK]: H(P.rock), [T.WALL]: [150, 140, 130], [T.FLOOR]: H(P.floor), [T.SAND]: H(P.sand), [T.HOLLOW]: H(P.hollow), [T.CRYSTAL]: [150, 120, 230], [T.DOOR]: [200, 160, 90], [T.COBBLE]: H(P.cobble), [T.BRIDGE]: H(P.floor), [T.SHELF]: [90, 60, 40], [T.RUG]: H(P.rug), [T.VOID]: H(P.void), [T.CHASM]: [5, 5, 10] };
    const img = g.createImageData(m.w, m.h);
    for (let i = 0; i < m.tiles.length; i++) { const cc = m.solid[i] ? [90, 70, 50] : (col[m.tiles[i]] ?? [0, 0, 0]); img.data.set([cc[0], cc[1], cc[2], 255], i * 4); }
    g.putImageData(img, 0, 0); this.mini = c; this.snapCamera();
  }

  // ── input ─────────────────────────────────────────────────────────────────
  get locked() { return G.uiBlock > 0 || G.chatFocus || !this.map; }
  key(e, down) {
    if (G.chatFocus || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName ?? '')) return;
    const k = e.key.toLowerCase();
    const mv = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
    if (mv[k]) { this.keys[mv[k]] = down; if (down) e.preventDefault(); return; }
    if (!down || e.repeat) return;
    if (k === 'm') { const m = toggleMute(); toggleMusic(m); toast(m ? 'Sound off.' : 'Sound on.'); return; }
    const act = actionFor(k); if (!act) return;
    if (act === 'dodge') e.preventDefault();
    if (act === 'interact') return this.interact();
    if (act === 'flask') return this.useFlask();
    if (act === 'dodge') return this.dodge();
    if (act.startsWith('skill')) return this.useSkill(+act.slice(5));
    if (act === 'heal') return this.useItem('heal');
    if (act === 'mana') return this.useItem('mana');
  }
  click(e) {
    const r = this.cv.getBoundingClientRect(), w = this.worldAt(e.clientX - r.left, e.clientY - r.top);
    if (e.button === 2) {
      let hit = null, best = 1.1;
      for (const p of G.players.values()) { if (p.id === G.id) continue; const d = Math.hypot(p.x - w.x, p.y - 0.5 - w.y); if (d < best) { best = d; hit = p; } }
      if (hit) this.onClickPlayer(hit, e); return;
    }
    if (e.button === 0 && !this.locked) this.mouseDown = true;
  }
  worldAt(sx, sy) { return { x: ((sx * this.dpr) / this.Z + this.cam.x) / TS, y: ((sy * this.dpr) / this.Z + this.cam.y) / TS }; }
  me() { return G.players.get(G.id); }
  aimAngle() {
    if (!this.mouseSeen) { const d = { u: -Math.PI / 2, d: Math.PI / 2, l: Math.PI, r: 0 }[G.dir] ?? 0; this.cursor = { x: G.pos.x + Math.cos(d) * 3, y: G.pos.y + Math.sin(d) * 3 }; return d; }
    const c = this.worldAt(this.mouse.x, this.mouse.y); this.cursor = c;
    return Math.atan2(c.y - (G.pos.y - 0.4), c.x - G.pos.x);
  }
  get canAct() { const me = this.me(); return !this.locked && !G.dead && !(me && me.sn) && !this.dash; }
  attack() { if (!this.canAct) return; const now = performance.now(), b = basicOf(G.me); if ((G.cd.basic ?? 0) > now) return; G.cd.basic = now + b.cd * 0.9; const a = this.aimAngle(); G.net.send({ t: 'atk', a, tx: this.cursor.x, ty: this.cursor.y }); G.lastAtk = now; }
  useSkill(i) {
    if (!this.canAct) return; const sid = loadoutOf(G.me)[i], sk = sid && SKILLS[sid]; if (!sk) return;
    const now = performance.now(); if ((G.cd[sk.id] ?? 0) > now) return; if (G.mp < sk.mp) { G.flashMana = now; return; }
    G.cd[sk.id] = now + sk.cd; G.cdMax[sk.id] = sk.cd; const a = this.aimAngle(); G.net.send({ t: 'skill', i, a, tx: this.cursor.x, ty: this.cursor.y });
  }
  dodge() {
    if (!this.canAct) return; const now = performance.now(); if ((G.cd.dodge ?? 0) > now) return; G.cd.dodge = now + 1100; G.cdMax.dodge = 1100;
    const ax = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0), ay = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
    G.net.send({ t: 'dodge', a: ax || ay ? Math.atan2(ay, ax) : this.aimAngle() + Math.PI });
  }
  useFlask() { if (!this.canAct) return; const fl = (G.me.flasks ?? []).filter((f) => f.form !== 'essence'), f = fl.find((x) => x.uid === G.me.quickFlask) ?? fl[0]; if (!f) return; const now = performance.now(); if ((G.cd.flask ?? 0) > now) return; G.cd.flask = now + 6000; G.cdMax.flask = 6000; const a = this.aimAngle(); G.net.send({ t: 'flask.use', uid: f.uid, a, tx: this.cursor.x, ty: this.cursor.y }); }
  useItem(kind) { if (!G.dead) G.net.send({ t: 'use', kind }); }
  startDash(x, y, ms) { this.dash = { x0: G.pos.x, y0: G.pos.y, x1: x, y1: y, t0: performance.now(), ms }; }
  snapCamera() { this.cam.x = G.pos.x * TS - this.vw / 2; this.cam.y = G.pos.y * TS - this.vh / 2; this.clampCam(); }
  clampCam() {
    const m = this.map, vw = this.vw, vh = this.vh;
    this.cam.x = m.w * TS <= vw ? (m.w * TS - vw) / 2 : Math.max(0, Math.min(m.w * TS - vw, this.cam.x));
    this.cam.y = m.h * TS <= vh ? (m.h * TS - vh) / 2 : Math.max(0, Math.min(m.h * TS - vh, this.cam.y));
  }
  interactables() {
    const out = [];
    for (const p of this.map.points) { if (p.kind === 'lamp') continue; if ((p.hidden || p.secret) && !G.vis.has(p.id)) continue; out.push({ id: p.id, x: p.x, y: p.y, name: p.name ?? NODE_TYPES[p.node]?.name ?? p.kind, p }); }
    for (const c of G.cust.values()) out.push({ id: c.id, x: c.x, y: c.y, name: `${c.n} (customer)`, cust: true });
    for (const d of this.map.decor) { const nm = SEARCHABLE[d.kind]; if (!nm) continue; const cx = d.x + (d.w ?? 1) / 2, cy = d.y + (d.h ?? 1) / 2; if (Math.abs(cx - G.pos.x) > 3 || Math.abs(cy - G.pos.y) > 3) continue; out.push({ id: `dec:${d.x},${d.y}`, x: cx, y: cy, name: nm }); }
    return out;
  }
  interact() { if (this.locked || G.dead) return; const it = this.nearest(); if (it) G.net.send({ t: 'interact', id: it.id }); else G.net.send({ t: 'search' }); }
  nearest() { let best = null, bd = 2.4; for (const i of this.interactables()) { const d = dist(G.pos.x, G.pos.y, i.x, i.y); if (d < bd) { bd = d; best = i; } } return best; }

  // ── update ────────────────────────────────────────────────────────────────
  update(dt, now) {
    this.t = now; this.dt = dt; hooks.shake = (m) => { this.shake = Math.min(0.4, Math.max(this.shake ?? 0, 0.1 * m)); };
    const me = this.me(); if (me) { G.hp = me.h; G.maxHp = me.mh; G.mp = me.mp; G.maxMp = me.mm; G.dead = !!me.dd; }
    const blocked = this.locked || G.dead || (me && me.sn);
    if (this.dash) { const k = Math.min(1, (now - this.dash.t0) / this.dash.ms), e = 1 - Math.pow(1 - k, 2); G.pos.x = this.dash.x0 + (this.dash.x1 - this.dash.x0) * e; G.pos.y = this.dash.y0 + (this.dash.y1 - this.dash.y0) * e; if (k >= 1) { this.dash = null; this.lastSentState = ''; } }
    let ax = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0), ay = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0);
    if (blocked || this.dash) ax = ay = 0;
    let moving = false;
    if (ax || ay) {
      const n = Math.hypot(ax, ay), sp = PLAYER_SPEED * (G.me?.unit?.move ?? 1) * dt / n * (G.guarding ? 0.6 : 1);
      const r = stepMove(this.map, G.pos.x, G.pos.y, ax * sp, ay * sp);
      moving = r.x !== G.pos.x || r.y !== G.pos.y; G.pos.x = r.x; G.pos.y = r.y;
      G.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'r' : 'l') : (ay > 0 ? 'd' : 'u');
    }
    G.moving = moving; this.aim = this.aimAngle();
    if (moving && now - (this.stepAt ?? 0) > 260) { this.stepAt = now; sfx('step', 200); const t0 = this.map.tiles[Math.floor(G.pos.y) * this.map.w + Math.floor(G.pos.x)], dcol = t0 === T.GRASS ? ['#5fa352', '#3d7a3a'] : t0 === T.WATER || t0 === T.BRIDGE ? ['#a6d8f4', '#ffffff'] : ['#c9b078', '#a38c58']; ingest([{ t: 'dust', x: G.pos.x, y: G.pos.y + 0.1, cols: dcol }]); }
    if (G.gather && now - (this.gatherAt ?? 0) > 170) { this.gatherAt = now; const nd = this.map.points.find((q) => q.id === G.gather.id); if (nd) { const ty = nd.node; ingest([{ t: 'dust', x: nd.x, y: nd.y - 0.2, cols: ty === 'herb' || ty === 'frostbloom' || ty === 'ghostbloom' ? ['#55a252', '#9af0b0'] : ty === 'hide' ? ['#8a5a38', '#a8704a'] : ['#c8c0b0', '#8a8278'], up: 1 }]); sfx(ty === 'herb' ? 'step' : 'hit', 170); } }
    if (!this.locked && !G.dead && !this.dash && !moving && (this.mouseDown || now - (G.lastAtk ?? 0) < 400)) G.dir = Math.cos(this.aim) > 0.3 ? 'r' : Math.cos(this.aim) < -0.3 ? 'l' : Math.sin(this.aim) > 0 ? 'd' : 'u';
    if ((this.mouseDown || this.touchAtk) && !blocked) this.attack();
    const st = `${moving ? 1 : 0}${G.dir}`;
    if (!blocked && !this.dash && (moving && now - this.lastSent > 80 || st !== this.lastSentState)) { this.lastSent = now; this.lastSentState = st; G.net.send({ t: 'move', x: +G.pos.x.toFixed(3), y: +G.pos.y.toFixed(3), d: G.dir, mv: moving ? 1 : 0, a: +this.aim.toFixed(2) }); }
    const k = 1 - Math.exp(-dt * 14);
    for (const e of [...G.players.values(), ...G.mobs.values()]) { if (e.rx === undefined) { e.rx = e.x; e.ry = e.y; } const ox = e.rx, oy = e.ry; e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; e.vx = e.rx - ox; e.vy = e.ry - oy; if (Math.abs(e.vx) > 0.002) e.face = e.vx > 0 ? 1 : -1; }
    const tx = G.pos.x * TS - this.vw / 2, ty = G.pos.y * TS - this.vh / 2, ck = 1 - Math.exp(-dt * 9); this.cam.x += (tx - this.cam.x) * ck; this.cam.y += (ty - this.cam.y) * ck; this.clampCam();
    this.prompt = blocked ? null : this.nearest(); this.onPrompt(this.prompt);
    if (this.flash > 0) this.flash -= dt; if (this.shake > 0) this.shake -= dt; if (this.hurtFlash > 0) this.hurtFlash -= dt;
  }

  // ── drawing ───────────────────────────────────────────────────────────────
  doorOpenAmount(tx, ty) {
    const key = ty * 1000 + tx, cx = tx + 0.5, cy = ty + 0.5; let near = dist(G.pos.x, G.pos.y, cx, cy) < 1.8;
    if (!near) for (const p of G.players.values()) if (p.id !== G.id && dist(p.x, p.y, cx, cy) < 1.8) { near = true; break; }
    if (!near) for (const m of G.mobs.values()) if (dist(m.x, m.y, cx, cy) < 1.5) { near = true; break; }
    let v = this.doors.get(key) ?? 0; const was = v; v += ((near ? 3 : 0) - v) * Math.min(1, this.dt * 10); this.doors.set(key, v); if ((was < 0.3 && v >= 0.3 || was > 2.6 && v <= 2.6 && !near) && dist(G.pos.x, G.pos.y, cx, cy) < 8) sfx('door', 150); return Math.round(v);
  }
  draw() {
    const g = this.g, m = this.map; if (!m) return;
    const t = this.t, Z = this.Z, W = this.cv.width, H = this.cv.height, th = m.theme, stone = m.id === 'archive';
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    const sh = this.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * this.shake) : 0;
    // The camera trails the player a little, but it must move in lock-step with the player's SNAPPED draw position: otherwise the two round at
    // different moments and the character shivers on screen while walking diagonally. The slow-moving lag is kept; only the rounding is shared.
    const rawX = G.pos.x * TS, rawY = G.pos.y * TS, vw = this.vw, vh = this.vh, edgeX = m.w * TS <= vw || this.cam.x <= 0 || this.cam.x >= m.w * TS - vw - 0.001, edgeY = m.h * TS <= vh || this.cam.y <= 0 || this.cam.y >= m.h * TS - vh - 0.001;
    const camX = Math.round(this.cam.x + (edgeX ? 0 : q(rawX) - rawX)), camY = Math.round(this.cam.y + (edgeY ? 0 : q(rawY) - rawY));
    g.setTransform(Z, 0, 0, Z, -camX * Z + sh, -camY * Z + sh);
    const x0 = Math.max(0, Math.floor(camX / TS) - 1), y0 = Math.max(0, Math.floor(camY / TS) - 1), x1 = Math.min(m.w - 1, Math.ceil((camX + this.vw) / TS) + 1), y1 = Math.min(m.h - 1, Math.ceil((camY + this.vh) / TS) + 3);
    const list = [], wf = Math.floor(t / 420) % 3, f3 = Math.floor(t / 170) % 3, f2 = Math.floor(t / 320) % 2;
    const tAt = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? T.WALL : m.tiles[y * m.w + x]);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const tt = m.tiles[ty * m.w + tx], v = Math.floor(((tx * 7 + ty * 13) % 4 + 4) % 4); let base = tt;
      if (tt === T.TREE) base = T.GRASS; else if (tt === T.ROCK) base = th === 'hollow' ? T.HOLLOW : T.SAND; else if (tt === T.CRYSTAL) base = T.HOLLOW; else if (tt === T.WALL || tt === T.SHELF || tt === T.DOOR) base = T.FLOOR;
      g.drawImage(groundTile(base, v, th, stone, tt === T.WATER ? wf : 0), tx * TS, ty * TS, TS, TS);
      const foot = (ty + 1) * TS, cxp = tx * TS + TS / 2;
      if (tt === T.WALL) { const capped = tAt(tx, ty - 1) !== T.WALL; list.push({ y: foot, fn: () => g.drawImage(wallSprite(th, capped, v & 1), tx * TS, foot - 40, TS, 40) }); }
      else if (tt === T.DOOR) { const open = this.doorOpenAmount(tx, ty); list.push({ y: ty * TS + 1, fn: () => g.drawImage(doorSprite(th, open), tx * TS, foot - 40, TS, 40) }); }
      else if (tt === T.TREE) list.push({ y: foot - 2, fn: () => { blit(g, shadowSprite(22), cxp + 3, foot + 1); blit(g, treeSprite(th, (tx * 3 + ty * 5) % 3, f2 && (tx + ty) % 2 ? 1 : 0), cxp, foot + 2); } });
      else if (tt === T.ROCK) list.push({ y: foot - 2, fn: () => blit(g, rockSprite(th, (tx + ty * 3) % 4), cxp, foot) });
      else if (tt === T.CRYSTAL) list.push({ y: foot - 2, fn: () => blit(g, crystalSprite((Math.floor(t / 500) + tx + ty) % 2), cxp, foot) });
      else if (tt === T.SHELF) list.push({ y: foot, fn: () => blit(g, shelfSprite((tx + ty) % 3), cxp, foot) });
      else if (tt === T.CHASM) { g.fillStyle = 'rgba(120,60,200,.10)'; g.fillRect(tx * TS, ty * TS, TS, TS); }
    }
    // portals: dithered pulse + chevrons
    for (const p of m.portals) { const px = p.x * TS, py = p.y * TS, pw = p.w * TS, ph = p.h * TS, pulse = Math.floor(t / 300) % 2; prect(g, px, py, pw, ph, th === 'hollow' ? 'rgba(190,140,255,.45)' : 'rgba(255,220,130,.40)', pulse); for (let i = 0; i < Math.max(p.w, p.h); i++) { const o = Math.floor(t / 160 + i) % 4 * C; if (p.w > p.h) { cellAt(g, px + i * TS + 14, py + 8 + o, '#ffffff'); cellAt(g, px + i * TS + 18, py + 8 + o, '#ffffff'); } else { cellAt(g, px + 8 + o, py + i * TS + 14, '#ffffff'); cellAt(g, px + 8 + o, py + i * TS + 18, '#ffffff'); } } }
    // decor
    for (const d of m.decor) {
      if (d.x * TS > camX + this.vw + 64 || (d.x + d.w) * TS < camX - 64 || d.y * TS > camY + this.vh + 64 || (d.y + d.h) * TS < camY - 64) continue;
      const cx = (d.x + d.w / 2) * TS, foot = (d.y + d.h) * TS;
      if (d.kind === 'window') { list.push({ y: foot + 1, fn: () => g.drawImage(prop('window', f2), d.x * TS + 6, foot - 28, 20, 20) }); continue; }
      const anim = { furnace: f3, cauldron: f3, lamp: f2, fireplace: f3, fountain: f2, obelisk: f2, campfire: f3 }[d.kind] ?? (d.kind === 'counter' ? (d.x + d.y) % 2 : 0);
      const spr = prop(d.kind, anim);
      if (d.kind === 'counter') { for (let i = 0; i < d.w; i++) { const k = i; list.push({ y: foot, fn: () => blit(g, prop('counter', (d.x + k + d.y) % 3 === 0 ? 1 : 0), (d.x + k + 0.5) * TS, foot) }); } continue; }
      if (d.kind === 'flowers' || d.kind === 'bones' || d.kind === 'mushrooms') { list.push({ y: foot - 30, fn: () => blit(g, spr, cx, foot) }); continue; }
      list.push({ y: foot, fn: () => blit(g, spr, cx, foot) });
    }
    for (const p of m.points) {
      if ((p.hidden || p.secret) && !G.vis.has(p.id)) continue;
      if (Math.abs(p.x - G.pos.x) > 26 || Math.abs(p.y - G.pos.y) > 16) continue;
      const X = p.x * TS, foot = (Math.floor(p.y) + 1) * TS;
      if (p.kind === 'node') list.push({ y: foot - 20, fn: () => blit(g, nodeSprite(p.node, G.cds.has(p.id)), X + (G.gather?.id === p.id ? (Math.floor(t / 70) % 2 ? C : -C) : 0), foot) });
      else if (p.kind === 'npc') list.push({ y: foot, fn: () => this.drawNpc(g, p, X, foot, t) });
      else list.push({ y: foot, fn: () => this.drawStation(g, p, X, foot, t, f3, f2) });
    }
    for (const c of G.cust.values()) list.push({ y: c.y * TS + 8, fn: () => { blit(g, shadowSprite(12), c.x * TS, c.y * TS + 8); blit(g, personSprite('merchant', 'd', 0, 3, '#caa24a'), c.x * TS, c.y * TS + 8); blit(g, uiIcon('coin'), c.x * TS, c.y * TS - 36 + (Math.floor(t / 300) % 2) * C); drawTag(g, c.n, c.x * TS, c.y * TS - 52, '#ffe9a8'); } });
    const mobs = [...G.mobs.values()].filter((mb) => mb.rx !== undefined);
    drawGround(g, mobs, G.zones, t); drawHazards(g, G.haz, (G.snapNow ?? 0) + (performance.now() - (G.snapAt ?? 0)), t);
    for (const mb of mobs) list.push({ y: mb.ry * TS + 6, fn: () => this.drawMob(g, mb, t) });
    for (const p of G.players.values()) { const self = p.id === G.id, X = (self ? G.pos.x : (p.rx ?? p.x)) * TS, Y = (self ? G.pos.y : (p.ry ?? p.y)) * TS; list.push({ y: Y + 8, fn: () => this.drawPlayer(g, p, self, X, Y, t) }); }
    list.sort((a, b) => a.y - b.y); for (const it of list) it.fn();
    drawWork(g, t); drawAir(g);
    for (const [id, b] of G.bubbles) { if (b.until < Date.now()) { G.bubbles.delete(id); continue; } const p = G.players.get(id); if (!p) continue; const self = id === G.id; drawTag(g, b.text.length > 30 ? b.text.slice(0, 29) + '.' : b.text, (self ? G.pos.x : p.rx ?? p.x) * TS, (self ? G.pos.y : p.ry ?? p.y) * TS - 54 - 28 - (p.tt ? 12 : 0), '#ffffff', { bg: '#101830', border: '#3a4a7a' }); }
    const nav = navTarget();
    for (const p of m.portals) { const cx = (p.x + p.w / 2) * TS, cy = (p.y + p.h / 2) * TS; if (cx < camX - 160 || cx > camX + this.vw + 160 || cy < camY - 60 || cy > camY + this.vh + 60) continue; const mine = nav?.portal === p; drawTag(g, mine ? `${p.label}  [YOUR ROUTE]` : p.label, cx, cy - (p.h > p.w ? 0 : 14), mine ? '#7fe0ff' : '#ffe9a8', { border: mine ? '#7fe0ff' : '#4a3a5a' }); }
    drawNumbers(g);
    if (!this.locked && !G.dead && this.mouseSeen) { const c = this.cursor, x = c.x * TS, y = c.y * TS; for (const [dx, dy] of [[-8, 0], [-6, 0], [6, 0], [8, 0], [0, -8], [0, -6], [0, 6], [0, 8]]) cellAt(g, x + dx - 1, y + dy - 1, 'rgba(255,255,255,.8)'); cellAt(g, x - 1, y - 1, 'rgba(255,255,255,.9)'); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawAtmosphere(g, W, H, t, m);
    this.drawCompass(g, W, H, camX, camY, Z, t);
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.8, this.flash * 2)})`; g.fillRect(0, 0, W, H); }
    const low = G.maxHp ? Math.max(0, 0.35 - G.hp / G.maxHp) / 0.35 : 0;
    if (this.hurtFlash > 0 || low > 0) vignette(g, W, H, '#c00000', Math.min(0.85, low * 0.55 + this.hurtFlash * 1.6), 'red');
    if (G.dead) { g.fillStyle = 'rgba(30,0,0,.55)'; g.fillRect(0, 0, W, H); }
  }

  drawStation(g, p, X, foot, t, f3, f2) {
    const near = dist(G.pos.x, G.pos.y, p.x, p.y) < 5;
    switch (p.kind) {
      case 'forge': blit(g, prop('anvil'), X, foot); break;
      case 'cauldron': blit(g, prop('cauldron', f3), X, foot); break;
      case 'exchange': blit(g, prop('board'), X, foot); break;
      case 'camp': blit(g, prop('campfire', f3), X, foot); break;
      case 'bazaar': blit(g, prop('stall'), X, foot); break;
      case 'gate': blit(g, prop('gate', (G.me?.items?.hollow_key ?? 0) > 0 && near ? 1 : 0), X, foot + 8); break;
      case 'chest': blit(g, prop('chest', (G.me?.cooldowns?.[`chest:${p.id}`] ?? 0) > Date.now() ? 1 : 0), X, foot); break;
      case 'secret': blit(g, prop(p.secret === 'lectern' ? 'lectern' : p.secret === 'coldforge' ? 'coldforge' : 'starfall', f2), X, foot);
        for (let i = 0; i < 4; i++) cellAt(g, X + Math.cos(t / 500 + i * 1.6) * 16, foot - 18 + Math.sin(t / 420 + i * 1.6) * 12, '#e0d0ff'); break;
      case 'board': blit(g, prop('board'), X, foot); break;
      case 'waystone': blit(g, prop('waystone', Math.floor(t / 400) % 2), X, foot + 4); if (near) for (let i = 0; i < 4; i++) cellAt(g, X + Math.cos(t / 450 + i * 1.6) * 12, foot - 20 - ((t / 40 + i * 14) % 22), '#9ad8ff'); break;
      default: blit(g, prop('sign'), X, foot);
    }
    if (near && p.name) drawTag(g, p.name, X, foot - (p.kind === 'gate' ? 76 : p.kind === 'waystone' ? 46 : 40), '#ffe9a8');
  }
  drawNpc(g, p, X, foot, t) {
    if (/Signpost/.test(p.name)) { blit(g, prop('sign'), X, foot); return; }
    const hidden = p.role === 'hidden', cls = NPC_CLS(p.id);
    blit(g, shadowSprite(12), X, foot); blit(g, personSprite(cls, 'd', Math.floor(t / 700) % 2 ? 2 : 0, (p.x | 0) + 3, NPC_COLORS[p.role] ?? '#556', { noGear: p.id.includes('innkeeper') }), X, foot);
    if (hidden) for (let i = 0; i < 4; i++) cellAt(g, X + Math.cos(t / 400 + i * 1.6) * 14, foot - 22 + Math.sin(t / 330 + i * 1.6) * 14, '#d9c2ff');
    drawTag(g, p.name, X, foot - 46, hidden ? '#d9c2ff' : '#ffffff');
    if (p.lines?.length && p.role !== 'hidden' && dist(G.pos.x, G.pos.y, p.x, p.y) < 7) { const slot = Math.floor(t / 8000 + (p.x * 7 + p.y * 13)), within = (t % 8000) < 3200; if (within && (slot % 3) !== 0) { const line = p.lines[slot % p.lines.length].replace(/\s+/g, ' '); drawTag(g, line.length > 38 ? line.slice(0, 36) + '...' : line, X, foot - 60, '#fff0c0'); } }
  }
  drawMob(g, mb, t) {
    const d = ENEMIES[mb.k], X = q(mb.rx * TS), Y = q(mb.ry * TS), boss = mb.bo, moving = Math.abs(mb.vx ?? 0) + Math.abs(mb.vy ?? 0) > 0.004, fr = Math.floor(t / (moving ? 150 : 400)) % 2;
    let spr, hgt;
    if (mb.k === 'reflection') { spr = personSprite('warrior', 'd', moving ? Math.floor(t / 120) % 4 : 0, mb.id, '#aab4ff'); hgt = 46; blit(g, shadowSprite(12), X, Y + 8); blit(g, spr, X, Y + 8); if (mb.fl) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(q(X - 12), q(Y - 40), 24, 46); } }
    else { spr = monsterSprite(d.shape, d.color, fr, !!mb.fl); if ((mb.face ?? 1) < 0) spr = flip(spr); hgt = spr.height * C; blit(g, shadowSprite(Math.round(spr.width * 0.7)), X, Y + 8); blit(g, spr, X, Y + 8 - (d.shape === 'wisp' ? 6 + fr * 2 : 0)); }
    const top = Y + 8 - hgt - 6;
    if (mb.h < mb.mh || boss) { const w = boss ? 56 : 30; g.fillStyle = '#0c0814'; g.fillRect(q(X - w / 2) - C, q(top) - C, w + 2 * C, 6 + 2 * C); g.fillStyle = mb.vu ? '#ff9ad5' : '#d9503f'; g.fillRect(q(X - w / 2), q(top), Math.round((w * Math.max(0, mb.h / mb.mh)) / C) * C, 6); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(q(X - w / 2), q(top), Math.round((w * Math.max(0, mb.h / mb.mh)) / C) * C, 2); }
    if (dist(G.pos.x, G.pos.y, mb.x, mb.y) < 10 || boss) drawTag(g, `${mb.nm ?? d.name} LV${mb.l}`, X, top - 6, mb.ch ? '#ff9a8f' : '#e8e0d0');
    if (mb.ch && !mb.w) drawText(g, '!', X + 12, top + 6, '#ff3b2e', { scale: 2 });
    if (mb.sn) for (let i = 0; i < 3; i++) { const a = t / 200 + i * 2.1; cellAt(g, X + Math.cos(a) * 10, top + 8 + Math.sin(a) * 3, '#ffe36b'); }
  }
  drawPlayer(g, p, self, X, Y, t) {
    X = q(X); Y = q(Y);            // snap the anchor once: the sprite and every label step together, so nothing jitters against anything else while moving
    const c = CLASSES[p.c] ?? CLASSES.warrior, moving = self ? G.moving || this.dash : p.mv, dir = self ? G.dir : p.d, partyMate = G.party?.members?.some((m) => m.id === p.id);
    const seed = (p.n.length + p.n.charCodeAt(0)) | 0, frame = moving ? Math.floor(t / 110) % 4 : 0, foot = Y + 8;
    if (p.dd) { blit(g, prop('grave'), X, foot); drawTag(g, p.n, X, foot - 40, '#9a8f86'); return; }
    blit(g, shadowSprite(12), X, foot);
    if (p.sl) g.globalAlpha = 0.4; if (self && this.dash) g.globalAlpha = 0.6;
    const bob = !moving && Math.floor(t / 650 + seed) % 2 ? 0 : (!moving ? -C / 2 : 0);
    blit(g, personSprite(p.c, dir, frame, seed, c.color), X, foot + bob); g.globalAlpha = 1; drawSwing(g, p.id, X, foot);
    const foe = G.guild?.war && p.gl && p.gl.toLowerCase() === G.guild.war.foe.toLowerCase(), hostile = !self && ((p.pv && G.pvp) || foe) && !partyMate, flagged = self ? !!G.pvp : !!p.pv;
    if (self || partyMate || p.dl || hostile || flagged) { const col = hostile || p.dl ? '#ff6a5a' : self && flagged ? '#ff9a5a' : self ? '#ffe9a8' : flagged ? '#c8a06a' : '#8fe0a8'; cellAt(g, X - 8, foot + 2, col); cellAt(g, X + 6, foot + 2, col); }
    if (p.gd) { pring(g, X, foot - 14, 22, C, '#7fb8ff'); pring(g, X, foot - 14, 18, C, 'rgba(127,184,255,.5)'); }
    if (p.sh) { for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28 + t / 600; cellAt(g, X + Math.cos(a) * 24, foot - 14 + Math.sin(a) * 24, '#a0dcff'); } }
    if (p.sn) for (let i = 0; i < 3; i++) { const a = t / 200 + i * 2.1; cellAt(g, X + Math.cos(a) * 10, foot - 48 + Math.sin(a) * 3, '#ffe36b'); }
    // Everything sits ABOVE the head (the sprite is ~46 world px tall): health bar, name, class plate, title.
    if (!self || p.h < p.mh) { const w = 26, hx = q(X - w / 2), hy = foot - 50; g.fillStyle = '#0c0814'; g.fillRect(hx - C, hy - C, w + 2 * C, 4 + 2 * C); g.fillStyle = self ? '#6fd08a' : '#4fb870'; g.fillRect(hx, hy, Math.round((w * Math.max(0, p.h / p.mh)) / C) * C, 4); }
    drawTag(g, `${p.gl ? `[${p.gl.slice(0, 5)}] ` : ''}${p.n} LV${p.l}`, X, foot - 53, self ? '#ffe9a8' : partyMate ? '#a8ffc2' : hostile || p.dl ? '#ff6a5a' : '#ffffff', { padX: 1, padY: 0, border: null, bg: 'rgba(12,8,20,.78)' });
    { const top = drawBadge(g, p, X, foot - 66, t); if (p.tt) drawTitle(g, p.tt, X, top - C, TITLE_COL[titleInfo(p.tt).rar] ?? '#d8cdbd'); }
    if (self && G.gather) { const k = Math.min(1, (performance.now() - G.gather.start) / G.gather.ms); g.fillStyle = '#0c0814'; g.fillRect(q(X - 16) - C, foot - 66, 32 + 2 * C, 8); g.fillStyle = '#e3b552'; g.fillRect(q(X - 16), foot - 64, Math.round(32 * k / C) * C, 4); }
  }
  drawAtmosphere(g, W, H, t, m) {
    const dpr = this.dpr;
    if (m.theme === 'hollow') {
      g.fillStyle = 'rgba(40,10,90,.18)'; g.fillRect(0, 0, W, H); vignette(g, W, H, '#0a001e', 0.85, 'hollow');
      for (const p of this.motes) { const x = Math.floor(((p.x + Math.sin(t / 2000 + p.p) * 0.02) % 1) * W / 4) * 4, y = Math.floor((((p.y - t / 40000 * p.s) % 1) + 1) % 1 * H / 4) * 4; g.fillStyle = `rgba(210,170,255,${0.25 + p.s * 0.4})`; g.fillRect(x, y, 4, 4); }
    } else {
      const now = G.serverNow || Date.now(), nl = m.dark ? 1 : nightLevel(dayPhase(now)), kind = m.dark ? null : weatherOf(m, now);
      if (kind === 'rain') { g.fillStyle = 'rgba(20,30,60,.16)'; g.fillRect(0, 0, W, H); }
      this.drawNight(g, W, H, t, m, m.id === 'town' ? nl * 0.9 : nl);
      if (kind) this.drawWeather(g, W, H, t, kind);
      if (nl > 0.25 && m.id === 'gloomwood') for (const p of this.motes.slice(0, 30)) { if (Math.sin(t / 300 + p.p) < -0.3) continue; const x = Math.floor(((p.x + Math.sin(t / 1500 + p.p) * 0.03) % 1) * W / 4) * 4, y = Math.floor(((p.y + Math.cos(t / 1900 + p.p) * 0.03) % 1) * H / 4) * 4; g.fillStyle = '#fff09a'; g.fillRect(x, y, 4, 4); }
      vignette(g, W, H, '#000000', 0.5, 'main');
    }
  }
  // Night: one coarse pixel layer of darkness with hard-edged circles of lamplight punched out of it.
  drawNight(g, W, H, t, m, nl) {
    if (nl < 0.05) return; const sc = 4, lw = Math.ceil(W / sc), lh = Math.ceil(H / sc);
    if (!this.lightCv || this.lightCv.width !== lw || this.lightCv.height !== lh) { this.lightCv = document.createElement('canvas'); this.lightCv.width = lw; this.lightCv.height = lh; }
    const lg = this.lightCv.getContext('2d'), Z = this.Z, cx = this.cam.x, cy = this.cam.y; lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, lw, lh); lg.fillStyle = `rgba(6,8,34,${(Math.round(nl * 10) / 10) * 0.8})`; lg.fillRect(0, 0, lw, lh);
    lg.globalCompositeOperation = 'destination-out';
    const light = (wx, wy, r, k = 1) => { const x = ((wx - cx) * Z) / sc, y = ((wy - cy) * Z) / sc, R = (r * Z) / sc; if (x < -R || y < -R || x > lw + R || y > lh + R) return; for (const [f, a] of [[1, 0.28], [0.72, 0.34], [0.45, 0.42]]) { lg.fillStyle = `rgba(0,0,0,${a * k})`; lg.beginPath(); lg.arc(Math.round(x), Math.round(y), Math.round(R * f), 0, 6.3); lg.fill(); } };
    for (const l of this.lights ?? []) light(l.x, l.y, l.r * (0.94 + 0.06 * Math.sin(t / 220 + l.x)), l.w ? 0.8 : 1);
    light(G.pos.x * TS, G.pos.y * TS - 10, 70);
    for (const o of G.players.values()) if (o.id !== G.id) light((o.rx ?? o.x) * TS, (o.ry ?? o.y) * TS - 10, 44);
    g.imageSmoothingEnabled = false; g.drawImage(this.lightCv, 0, 0, lw * sc, lh * sc);
  }
  drawWeather(g, W, H, t, kind) {
    const n = kind === 'snow' ? 90 : kind === 'ember' ? 50 : 130;
    for (let i = 0; i < n; i++) {
      const p = this.motes[i % this.motes.length], seed = (i * 0.6180339) % 1, sp = 0.5 + ((i * 37) % 10) / 12;
      if (kind === 'rain') { const x = Math.floor((((seed * 7.3 + t / 9000 * sp * 0.4) % 1) * W) / 4) * 4, y = Math.floor((((p.y * 3 + i * 0.07 + t / 380 * sp) % 1) * H) / 4) * 4; g.fillStyle = 'rgba(160,190,240,.55)'; g.fillRect(x, y, 4, 12); g.fillStyle = 'rgba(220,235,255,.5)'; g.fillRect(x, y + 8, 4, 4); }
      else if (kind === 'snow') { const x = Math.floor((((seed * 9.1 + Math.sin(t / 1400 + i) * 0.02) % 1 + 1) % 1) * W / 4) * 4, y = Math.floor((((p.y + i * 0.031 + t / 5200 * sp) % 1) * H) / 4) * 4; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x, y, 4, 4); }
      else { const x = Math.floor((((seed * 5.7 + Math.sin(t / 900 + i) * 0.03) % 1 + 1) % 1) * W / 4) * 4, y = Math.floor(((1 - ((p.y + i * 0.05 + t / 7000 * sp) % 1)) * H) / 4) * 4; g.fillStyle = i % 3 ? '#ff8a3a' : '#ffd36a'; g.fillRect(x, y, 4, 4); }
    }
  }

  // Arrows at the screen edge pointing at every exit that is not on screen; the exit on your tracked route is gold and larger.
  drawCompass(g, W, H, camX, camY, Z, t) {
    const m = this.map, nav = navTarget(); if (!m || G.dead) return;
    const ins = 58, cxm = W / 2, cym = H / 2; g.save(); g.textBaseline = 'middle';
    for (const p of m.portals) {
      const wx = (p.x + p.w / 2) * TS, wy = (p.y + p.h / 2) * TS, sx = (wx - camX) * Z, sy = (wy - camY) * Z;
      if (sx > ins && sx < W - ins && sy > ins && sy < H - ins) continue;
      const mine = nav?.portal === p, dx = sx - cxm, dy = sy - cym, k = Math.min((W / 2 - ins) / Math.abs(dx || 1e-6), (H / 2 - ins) / Math.abs(dy || 1e-6)), ax = cxm + dx * k, ay = cym + dy * k, ang = Math.atan2(dy, dx);
      const tiles = Math.round(Math.hypot(wx - G.pos.x * TS, wy - G.pos.y * TS) / TS), label = (p.label ?? '').replace(/^(< )?To /, '').replace(/ [><^v]$/, '').replace(/^Moonlit Pass: /, '');
      const pulse = mine ? 1 + 0.12 * Math.sin(t / 220) : 1, r = (mine ? 17 : 12) * pulse, col = mine ? '#ffd24a' : '#e8e0f0';
      g.globalAlpha = mine ? 1 : 0.78; g.translate(ax, ay); g.rotate(ang); g.fillStyle = col; g.strokeStyle = '#120d1c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.7, -r * 0.8); g.lineTo(-r * 0.3, 0); g.lineTo(-r * 0.7, r * 0.8); g.closePath(); g.stroke(); g.fill(); g.rotate(-ang); g.translate(-ax, -ay);
      g.font = `${mine ? 'bold 13' : '11'}px 'Pixel', monospace`; const line1 = label.length > 26 ? label.slice(0, 25) + '.' : label, line2 = `${tiles} tiles${mine ? '  - your route' : ''}`;
      const tw = Math.max(g.measureText(line1).width, g.measureText(line2).width) + 12, th = mine ? 34 : 30; let bx = ax - dx / Math.hypot(dx, dy || 1) * (r + 6) - (dx > 0 ? tw : 0), by = ay - dy / Math.hypot(dx || 1, dy) * (r + 6) - th / 2;
      bx = Math.max(6, Math.min(W - tw - 6, bx)); by = Math.max(6, Math.min(H - th - 6, by));
      g.fillStyle = 'rgba(14,10,24,.82)'; g.fillRect(bx, by, tw, th); g.strokeStyle = mine ? '#ffd24a' : '#4a3a5a'; g.lineWidth = 2; g.strokeRect(bx + 1, by + 1, tw - 2, th - 2);
      g.fillStyle = mine ? '#ffe9a8' : '#fff'; g.fillText(line1, bx + 6, by + th * 0.33); g.fillStyle = '#b8a8d8'; g.fillText(line2, bx + 6, by + th * 0.72); g.globalAlpha = 1;
    }
    g.restore();
  }
  drawMinimap(cv) {
    if (!this.mini) return; const g = cv.getContext('2d'), m = this.map, s = Math.min(cv.width / m.w, cv.height / m.h);
    g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; g.drawImage(this.mini, 0, 0, m.w * s, m.h * s);
    for (const p of G.players.values()) { g.fillStyle = p.id === G.id ? '#ffe36b' : '#7fe0ff'; g.fillRect(Math.round((p.id === G.id ? G.pos.x : p.x) * s) - 1, Math.round((p.id === G.id ? G.pos.y : p.y) * s) - 1, 3, 3); }
    for (const mb of G.mobs.values()) { g.fillStyle = mb.bo ? '#ff9a2a' : '#ff5a4a'; g.fillRect(Math.round(mb.x * s) - 1, Math.round(mb.y * s) - 1, mb.bo ? 4 : 2, mb.bo ? 4 : 2); }
    const nav = navTarget(); for (const p of m.portals) { const mine = nav?.portal === p, blink = mine && Math.floor(performance.now() / 350) % 2; g.fillStyle = mine ? (blink ? '#7fe0ff' : '#ffd24a') : '#ffd24a'; g.fillRect(Math.round(p.x * s) - 1, Math.round(p.y * s) - 1, Math.max(4, Math.round(p.w * s) + 2), Math.max(4, Math.round(p.h * s) + 2)); g.strokeStyle = '#000'; g.strokeRect(Math.round(p.x * s) - 1.5, Math.round(p.y * s) - 1.5, Math.max(4, Math.round(p.w * s) + 2) + 1, Math.max(4, Math.round(p.h * s) + 2) + 1); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.strokeRect(Math.round(this.cam.x / TS * s), Math.round(this.cam.y / TS * s), Math.round(this.vw / TS * s), Math.round(this.vh / TS * s));
  }
}
