// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME COMBAT — authoritative. Mixed into GameServer.
// Players aim with the mouse and attack in real time; enemies chase, telegraph and strike.
// All hit detection (arcs, circles, projectiles) happens here; clients only draw it.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp } from '../rng.js';
import { ENEMIES, CLASSES, SKILLS, BASICS, MOVES, ZONES } from '../data.js';
import { getMap, blockedAt, inSafeZone, realmOf, dist, TS } from '../world.js';
import { rtStats, enemyStats, shadeStats, enemyLevel, computeRewards, calcDamage, mobHit } from '../units.js';
import { HP_SCALE } from '../data.js';
import { loadoutOf, basicOf, comboOf, perkOf } from '../loadout.js';
import { DRAUGHT_FX, FLASK_FX } from '../custom.js';
import * as R from '../rules.js';

const MOB_DMG = 1.3, DROP_DIST = 32, MOB_HEAL_DELAY = 10000, MOB_HEAL_RATE = 0.02, MOB_TICK = 0.05, DEAD_MS = 4000, REGEN_DELAY = 6000;   // enemies give up only when you are DROP_DIST tiles away; they heal 2%/s after 10 s unhurt
const RADIUS = { brute: 0.6, warden: 0.95, unwritten: 1.05, husk: 0.55, stag: 0.55, hound: 0.4, worm: 0.55 };
const SHADE_MOVES = { warrior: ['smash', 'lunge'], blacksmith: ['smash', 'slam'], soulsmith: ['smash', 'slam'], mage: ['nova', 'flick'], archer: ['flick', 'lunge'], alchemist: ['spit', 'nova'], transmuter: ['spit', 'nova'], merchant: ['flick', 'claw'], broker: ['flick', 'claw'], desperado: ['flick', 'claw', 'lunge'], archivist: ['page_storm', 'spit'] };
const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
const rad = (d) => (d * Math.PI) / 180;

export const combatMethods = {
  initCombat() { this.projs = []; this.zones = []; this.timers = []; this.fx = {}; this.nextEnt = 1; },

  // ── helpers ───────────────────────────────────────────────────────────────
  emit(mapId, e) { (this.fx[mapId] ??= []).push(e); if (this.fx[mapId].length > 200) this.fx[mapId].shift(); },
  later(ms, fn) { if (ms <= 0) return fn(); this.timers.push({ at: this.now() + ms, fn }); },

  initPlayerCombat(S) {
    S.rt = rtStats(S.P); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp;
    Object.assign(S, { cds: {}, dead: false, deadUntil: 0, stunUntil: 0, iframeUntil: 0, guardUntil: 0, guardRed: 0, guardReflect: 0, shield: 0, shieldUntil: 0, stealthUntil: 0, tauntRed: 0, tauntUntil: 0, lastHurt: 0, lastAct: 0, aim: 0, dashLock: 0, duel: null, pvp: false, pvpTag: 0, critAll: 0, combo: null, buff: null, voidStacks: 0, lastKillAt: 0, reviveAt: 0, auraNext: 0 });
  },
  recalc(S) {
    const old = S.rt; S.rt = rtStats(S.P);
    if (!old || old.maxHp !== S.rt.maxHp) { const f = old ? S.hp / old.maxHp : 1; S.hp = Math.min(S.rt.maxHp, Math.max(1, Math.round(S.rt.maxHp * f))); }
    S.mp = Math.min(S.mp, S.rt.maxMp);
  },
  // The 4 equipped skills (null = empty slot). Which skills exist/are known is decided by loadout.js.
  classSkills(S) { return loadoutOf(S.P).map((id) => (id ? SKILLS[id] : null)); },
  inCombat(S) { return this.now() - S.lastHurt < REGEN_DELAY || this.now() - S.lastAct < 3000; },
  // Fighting above your level is punished both ways: you deal much less and they deal more.
  gapMult(mob, S) { const g = (mob?.level ?? 0) - S.P.level; return g > 0 ? Math.min(3, 1 + 0.1 * g) : 1; },
  buffOf(S) { const b = S.buff; return b && this.now() < b.until ? b : null; },
  healBonus(S) { return (S.rt.status?.healMult ?? 0) + (perkOf(S.P).heal ?? 0); },
  allies(S, radius) {
    const pt = this.parties.get(S.partyId), out = [];
    if (pt) for (const id of pt.members) { const o = this.sessions.get(id); if (o && o !== S && o.map === S.map && !o.dead && dist(o.x, o.y, S.x, S.y) <= radius) out.push(o); }
    return out;
  },
  healPlayer(S, amount, src = null) {
    amount = Math.round(amount * (1 + this.healBonus(src ?? S))); if (amount <= 0 || S.dead) return 0;
    S.hp = Math.min(S.rt.maxHp, S.hp + amount); this.emit(S.map, { t: 'dmg', x: S.x, y: S.y - 0.8, v: amount, k: 'heal' }); return amount;
  },

  // enemies a player may hit right now (mobs on the map, plus a duel opponent)
  targetsFor(S) {
    const out = this.mobs.filter((m) => m.map === S.map && !m.deadUntil && m.hp > 0);
    for (const t of this.pvpTargets(S)) out.push(t);
    return out;
  },

  // ── player input ──────────────────────────────────────────────────────────
  canAct(S) { return !S.dead && S.stunUntil <= this.now() && this.now() >= S.dashLock; },
  on_atk(S, m) {
    if (!this.canAct(S)) return;
    const b = basicOf(S.P), now = this.now(), key = 'basic';
    if ((S.cds[key] ?? 0) > now) return;
    let sk = { ...b, id: 'basic', mp: 0, cast: b.kind === 'melee' ? 30 : 60 }, cd = b.cd;
    const combo = b.kind === 'melee' ? comboOf(b) : null;
    if (combo) {
      const prev = S.combo, n = prev && now - prev.at < combo.window ? (prev.n + 1) % combo.steps.length : 0, st = combo.steps[n];
      S.combo = { n, at: now };
      cd = b.cd * (st.cd / combo.steps[0].cd);
      sk = { ...sk, power: b.power * st.power, range: b.range * st.range, arc: Math.min(300, b.arc * st.arc), step: n, dir: st.dir, hit: st.hit, fx: { ...(b.fx ?? {}), ...(st.knock ? { knock: st.knock } : {}) }, stun: st.stun };
      this.lunge(S, +m.a || 0, st.lunge * (b.range > 2 ? 0.7 : 1));
    }
    S.cds[key] = now + cd; this.cast(S, sk, +m.a || 0, +m.tx, +m.ty);
  },
  // A short step into the swing; stops when an enemy is in the way.
  lunge(S, a, d) {
    if (!(d > 0)) return;
    const map = getMap(S.map), foes = this.mobs.filter((m) => m.map === S.map && !m.deadUntil && m.hp > 0);
    let x = S.x, y = S.y;
    for (let k = 0; k < Math.ceil(d / 0.1); k++) {
      const nx = x + Math.cos(a) * 0.1, ny = y + Math.sin(a) * 0.1;
      if (blockedAt(map, nx, ny) || foes.some((f) => dist(nx, ny, f.x, f.y) < (f.radius ?? 0.4) + 0.55)) break;
      x = nx; y = ny;
    }
    if (x === S.x && y === S.y) return;
    S.x = x; S.y = y; S.dashLock = this.now() + 90; S.conn.send({ t: 'dash', x, y, ms: 100 });
  },
  on_skill(S, m) {
    if (!this.canAct(S)) return;
    const sk = this.classSkills(S)[Math.floor(+m.i)]; if (!sk) return;
    const now = this.now();
    if ((S.cds[sk.id] ?? 0) > now) return;
    if (S.mp < sk.mp) { S.conn.send({ t: 'nomana' }); return; }
    S.mp -= sk.mp; S.cds[sk.id] = now + sk.cd;
    this.cast(S, sk, +m.a || 0, +m.tx, +m.ty);
  },
  on_dodge(S, m) {
    if (!this.canAct(S)) return;
    const now = this.now(); if ((S.cds.dodge ?? 0) > now) return;
    S.cds.dodge = now + 1100;
    this.dash(S, +m.a || 0, 2.9, 340, 380);
  },
  on_use(S, m) {
    if (S.dead) return;
    const id = m.kind === 'mana' ? R.quickMana(S.P) : R.quickHeal(S.P), now = this.now(), ck = `item_${m.kind}`;
    if (!id) return this.toast(S, m.kind === 'mana' ? 'No mana potions.' : 'No healing potions.', 'bad');
    if ((S.cds[ck] ?? 0) > now) return;
    const u = R.ITEM_USE[id];
    if ((u.hp || u.pct) && S.hp >= S.rt.maxHp) return; if ((u.mp || u.mpPct) && S.mp >= S.rt.maxMp) return;
    R.removeItem(S.P, id); S.cds[ck] = now + 5000;
    const pot = R.potionPotency?.(S.P, id) ?? 1;
    if (u.hp || u.pct) this.healPlayer(S, (u.hp ? u.hp * HP_SCALE : S.rt.maxHp * u.pct) * pot);
    if (u.mp || u.mpPct) { const mp = Math.round(u.mp ?? S.rt.maxMp * u.mpPct); S.mp = Math.min(S.rt.maxMp, S.mp + mp); this.emit(S.map, { t: 'dmg', x: S.x, y: S.y - 0.8, v: mp, k: 'mana' }); }
    S.conn.send({ t: 'cd', k: ck, ms: 5000 }); this.touch(S);
  },

  // Custom potions: a Draught buffs/heals the drinker; a Flask is thrown and bursts at the cursor.
  applyFlask(S, fl, a, tx, ty) {
    const now = this.now();
    if (fl.form === 'draught') {
      for (const e of fl.fx) {
        const d = DRAUGHT_FX[e.id]?.fx; if (!d) continue; const k = e.k ?? 1;
        if (d.heal) this.healPlayer(S, S.rt.maxHp * d.heal * k);
        if (d.mana) { const m = Math.round(S.rt.maxMp * d.mana * k); S.mp = Math.min(S.rt.maxMp, S.mp + m); this.emit(S.map, { t: 'dmg', x: S.x, y: S.y - 0.8, v: m, k: 'mana' }); }
        if (d.shield) { S.shield = Math.round(S.rt.maxHp * d.shield * k); S.shieldUntil = now + (d.buff?.ms ?? 12000); }
        if (d.buff) { const { ms, ...vals } = d.buff, cur = this.buffOf(S) ?? {}, nb = { ...cur }; for (const [key, v] of Object.entries(vals)) nb[key] = key === 'mpRegen' ? Math.max(nb[key] ?? 1, 1 + (v - 1) * k) : (nb[key] ?? 0) + v * k; nb.id = 'flask'; nb.until = Math.max(cur.until ?? 0, now + ms); S.buff = nb; S.conn.send({ t: 'buff', id: 'flask', ms }); }
      }
      this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 1.2, c: 'heal' }); return;
    }
    const sk = { kind: 'aoe', power: 0, radius: 2.3, range: 8, at: 'cursor', type: 'arcane', col: '#9ae06a' }; let field = null;
    for (const e of fl.fx) { const d = FLASK_FX[e.id]?.fx; if (!d) continue; const k = e.k ?? 1;
      if (d.power) sk.power += d.power * k; if (d.slow) sk.slow = Math.max(sk.slow ?? 0, Math.round(d.slow * k)); if (d.stun) sk.stun = Math.max(sk.stun ?? 0, Math.round(d.stun * k));
      if (d.dot && !sk.dot) { sk.dot = { k: d.dot.k, ticks: d.dot.ticks, every: 400 }; sk.power = Math.max(sk.power, d.dot.power * k); } if (d.field) field = d.field * k; }
    this.emit(S.map, { t: 'cast', who: S.id, sk: 'flask', a, ms: 250, kind: 'proj', ty: 'arcane' });
    this.later(250, () => {
      if (S.dead) return; const [cx, cy] = this.aimPoint(S, sk, tx, ty);
      if (field) this.zones.push({ id: this.nextEnt++, map: S.map, x: cx, y: cy, r: 2.6, k: 'holy', field: { heal: field, every: 1000 }, owner: S.id, power: 0, every: 1000, next: now + 1000, until: now + 6000, sk: { kind: 'field' } });
      if (sk.power > 0 || sk.dot || sk.stun || sk.slow) this.playerAoe(S, sk, cx, cy);
    });
  },

  cast(S, sk, a, tx, ty) {
    S.aim = a; S.lastAct = this.now(); S.stealthUntil = Math.min(S.stealthUntil, this.now());
    this.emit(S.map, { t: 'cast', who: S.id, sk: sk.id, a, ms: sk.cast ?? 0, kind: sk.kind, ty: sk.type, step: sk.step ?? 0, dir: sk.dir ?? 1, q: sk.quiet ? 1 : 0 });
    if (sk.vfxCast) { const [cx, cy] = this.aimPoint(S, sk, tx, ty); this.emit(S.map, { t: 'vfx', id: sk.vfxCast, who: S.id, x: S.x, y: S.y, a, cx, cy, r: sk.radius ?? 0, col: sk.col ?? null }); }
    // Desperado: before every attack except All In he rolls the dice; each die's face multiplies that shot's base damage.
    let rolls = null, wait = 0;
    if (S.P.classId === 'desperado' && sk.id !== 'all_in' && sk.kind !== 'buff') {
      const n = sk.id === 'basic' ? 1 : sk.kind === 'proj' ? sk.count ?? 1 : 1; rolls = Array.from({ length: n }, () => this.rng.int(1, 6)); wait = sk.id === 'basic' ? 0 : 300;
      this.emit(S.map, { t: 'vfx', id: 'dice_roll', who: S.id, x: S.x, y: S.y, a, rolls, basic: sk.id === 'basic' ? 1 : 0 });
    }
    this.later((sk.cast ?? 0) + wait, () => { if (!S.dead && this.sessions.get(S.id) === S) { this.resolveSkill(S, sk, a, tx, ty, rolls); this.postEffects(S, sk); } });
  },
  diceMult(sk, rolls, i = 0) { return rolls ? rolls[i % rolls.length] * (sk.id === 'basic' ? 0.3 : 0.28) : 1; },
  // Aim point for ground-targeted skills, clamped to range.
  aimPoint(S, sk, tx, ty) {
    if (sk.at === 'cursor' && Number.isFinite(tx) && Number.isFinite(ty)) { const d = dist(S.x, S.y, tx, ty), k = sk.range && d > sk.range ? sk.range / d : 1; return [S.x + (tx - S.x) * k, S.y + (ty - S.y) * k]; }
    return [S.x, S.y];
  },
  resolveSkill(S, sk, a, tx, ty, rolls = null) {
    const now = this.now();
    if (sk.stealth && sk.kind !== 'dash') S.stealthUntil = now + sk.stealth;
    if (sk.vfx && sk.kind !== 'dash') { const [cx, cy] = this.aimPoint(S, sk, tx, ty); this.emit(S.map, { t: 'vfx', id: sk.vfx, who: S.id, x: S.x, y: S.y, a, cx, cy, r: sk.radius ?? 0, range: sk.range ?? 0, arc: sk.arc ?? 0, step: sk.step ?? 0, dir: sk.dir ?? 1, big: sk.hit ? 1 : 0, col: sk.col ?? null }); }
    switch (sk.kind) {
      case 'melee': { const n = sk.hits ?? 1; for (let i = 0; i < n; i++) this.later(i * (sk.interval ?? 0), () => { if (!S.dead) this.meleeHit(S, sk, a); }); break; }
      case 'proj': this.fireProjectiles(S, sk, a, rolls); break;
      case 'aoe': { const [cx, cy] = this.aimPoint(S, sk, tx, ty); this.playerAoe(S, sk, cx, cy); break; }
      case 'dash': this.dash(S, sk.back ? a + Math.PI : a, sk.dist, 260, sk.iframes ?? 300, sk, rolls); break;
      case 'guard': S.guardUntil = now + sk.dur; S.guardRed = sk.red; S.guardReflect = sk.reflect ?? 0; S.conn.send({ t: 'cd', k: 'guard', ms: sk.dur }); break;
      case 'heal': {
        const targets = [S, ...(sk.party ? this.allies(S, sk.party) : [])];
        for (const T of targets) {
          if (sk.shield) { T.shield = (sk.shield + S.P.level * 4) * HP_SCALE; T.shieldUntil = now + (sk.dur ?? 4000); }
          if (sk.heal) this.healPlayer(T, T.rt.maxHp * sk.heal, S);
          if (!sk.quiet) this.emit(S.map, { t: 'aura', x: T.x, y: T.y, r: 1, c: sk.shield ? 'ward' : 'heal' });
        }
        break;
      }
      case 'taunt':
        for (const m of this.mobs) if (m.map === S.map && !m.deadUntil && dist(m.x, m.y, S.x, S.y) <= sk.radius) { m.target = S.id; m.tauntUntil = now + sk.dur; }
        S.tauntRed = sk.red; S.tauntUntil = now + sk.dur; this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: sk.radius, c: 'taunt' }); break;
      case 'mark':
        for (const m of this.mobs) if (m.map === S.map && !m.deadUntil && dist(m.x, m.y, S.x, S.y) <= sk.radius) { m.vulnUntil = now + sk.dur; m.vuln = sk.vuln; }
        if (!sk.quiet) this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: sk.radius, c: 'mark' }); break;
      case 'buff': {
        const targets = [S, ...(sk.radius ? this.allies(S, sk.radius) : [])];
        for (const T of targets) { T.buff = { id: sk.id, until: now + sk.dur, ...sk.buff }; T.conn.send({ t: 'buff', id: sk.id, ms: sk.dur }); if (!sk.quiet) this.emit(S.map, { t: 'aura', x: T.x, y: T.y, r: 1.1, c: 'rage' }); }
        break;
      }
      case 'trap': {
        const [cx, cy] = this.aimPoint(S, { ...sk, at: 'cursor' }, tx, ty);
        this.zones.push({ id: this.nextEnt++, map: S.map, x: cx, y: cy, r: sk.radius, k: 'trap', trap: true, owner: S.id, power: sk.power, type: sk.type, stun: sk.stun, until: now + sk.dur, armedAt: now + 700, sk });
        break;
      }
      case 'field': {
        const [cx, cy] = this.aimPoint(S, sk, tx, ty), f = sk.field;
        this.zones.push({ id: this.nextEnt++, map: S.map, x: cx, y: cy, r: sk.radius, k: sk.k ?? 'holy', field: f, owner: S.id, power: f.dmg ?? 0, type: sk.type, every: f.every, next: now + f.every, until: now + sk.dur, sk });
        if (!sk.quiet) this.emit(S.map, { t: 'aura', x: cx, y: cy, r: sk.radius, c: 'heal' });
        break;
      }
      default: break;
    }
  },
  // Effects that ride on top of any kind: buffs, shields, heals, stealth already handled.
  postEffects(S, sk) {
    const now = this.now();
    if (sk.kind !== 'buff' && sk.buff) { S.buff = { id: sk.id, until: now + (sk.dur ?? 6000), ...sk.buff }; S.conn.send({ t: 'buff', id: sk.id, ms: sk.dur ?? 6000 }); }
    if (sk.kind !== 'heal' && sk.shield) { S.shield = (sk.shield + S.P.level * 4) * HP_SCALE; S.shieldUntil = now + (sk.dur ?? 5000); }
    if ((sk.kind === 'guard' || sk.kind === 'aoe') && sk.heal) { this.healPlayer(S, S.rt.maxHp * sk.heal); if (sk.party) for (const o of this.allies(S, sk.party)) this.healPlayer(o, o.rt.maxHp * sk.heal * 0.8, S); }
  },

  meleeHit(S, sk, a) {
    if (!sk.quiet) this.emit(S.map, { t: 'slash', x: S.x, y: S.y, a, range: sk.range, arc: sk.arc, ty: sk.type, who: S.id, step: sk.step ?? 0, dir: sk.dir ?? 1, big: sk.hit ? 1 : 0, mag: sk.mag ? 1 : 0 });
    let n = 0;
    for (const t of this.targetsFor(S)) {
      const d = dist(S.x, S.y, t.x, t.y); if (d > sk.range + (t.radius ?? 0.4)) continue;
      if (sk.arc < 359 && angDiff(ang(S.x, S.y, t.x, t.y), a) > rad(sk.arc) / 2 && d > 0.6) continue;
      this.hit(S, t, sk.power, sk.type, sk, a); n++;
    }
    if (n && (sk.hit || (sk.power ?? 0) > 40)) this.emit(S.map, { t: 'shake', who: S.id, m: sk.hit ? 1 : 0.6 });
  },
  fireProjectiles(S, sk, a, rolls = null) {
    const n = sk.count ?? 1, sp = sk.spread ?? 0;
    for (let i = 0; i < n; i++) {
      const off = sp >= 360 ? (i / n) * Math.PI * 2 : n === 1 ? 0 : rad(sp) * (i / (n - 1) - 0.5);
      this.spawnProj({ map: S.map, x: S.x + Math.cos(a) * 0.4, y: S.y + Math.sin(a) * 0.4, a: a + off, speed: sk.speed, r: sk.radius ?? 0.25, power: rolls ? Math.max(1, Math.round(sk.power * this.diceMult(sk, rolls, i))) : sk.power, face: rolls ? rolls[i % rolls.length] : null, type: sk.type, range: sk.range, pierce: sk.pierce ?? 0, aoe: sk.aoe ?? 0, sk, col: sk.col, vi: this.projVis(S, sk), owner: { k: 'p', id: S.id } });
    }
  },
  // Which artwork a player's projectile uses.
  projVis(S, sk) {
    if (sk.vi) return sk.vi;
    const c = S.P.classId, path = S.P.asc?.path;
    if (sk.id === 'basic') {
      if (['archer'].includes(c) || ['ranger', 'sniper', 'windrunner'].includes(path)) return 'arrow';
      if (['merchant', 'broker', 'gilded'].includes(c)) return 'coin'; if (['alchemist', 'transmuter', 'philosopher'].includes(c)) return 'flask'; if (c === 'desperado') return 'card'; if (c === 'archivist') return 'quill';
      if (path === 'pyromancer') return 'fire'; if (c === 'void_sovereign') return 'void'; return 'orb';
    }
    const g = sk.g; if (g === 'flame') return 'fire'; if (g === 'frost') return 'ice'; if (g === 'bolt') return 'bolt'; if (g === 'leaf') return 'thorn'; if (g === 'void') return 'void'; if (g === 'coin') return 'coin'; if (g === 'drop') return 'flask'; if (g === 'star') return 'star';
    return sk.type === 'pierce' ? 'arrow' : sk.type === 'arcane' ? 'orb' : sk.type === 'slash' ? 'wave' : 'boulder';
  },
  spawnProj(o) {
    const p = { id: this.nextEnt++, hit: new Set(), ttl: o.range / o.speed, vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed, ...o };
    this.projs.push(p); return p;
  },
  playerAoe(S, sk, cx, cy) {
    if (!sk.quiet) this.emit(S.map, { t: 'boom', x: cx, y: cy, r: sk.radius, ty: sk.type, who: S.id, g: sk.g ?? null });
    if (sk.dot) { this.zones.push({ id: this.nextEnt++, map: S.map, x: cx, y: cy, r: sk.radius, k: sk.dot.k ?? 'acid', owner: S.id, power: sk.power, type: sk.type, left: sk.dot.ticks, every: sk.dot.every, next: this.now() + sk.dot.every, until: this.now() + sk.dot.ticks * sk.dot.every, sk, slow: sk.slow }); if (sk.stun) for (const t of this.targetsFor(S)) if (!t.isPlayer && dist(cx, cy, t.x, t.y) <= sk.radius + t.radius) t.stunUntil = this.now() + sk.stun; return; }
    for (const t of this.targetsFor(S)) { if (dist(cx, cy, t.x, t.y) <= sk.radius + t.radius) { this.hit(S, t, sk.power, sk.type, sk, ang(cx, cy, t.x, t.y)); if (sk.stun && !t.isPlayer) t.stunUntil = this.now() + sk.stun * (t.boss ? 0.5 : 1); } }
    if (sk.power >= 60) this.emit(S.map, { t: 'shake', who: S.id, m: 1 });
  },
  dash(S, a, d, ms, iframes, sk = null, rolls = null) {
    const map = getMap(S.map); let x = S.x, y = S.y; const fromX = S.x, fromY = S.y;
    for (let k = 0; k < d / 0.2; k++) { const nx = x + Math.cos(a) * 0.2, ny = y + Math.sin(a) * 0.2; if (blockedAt(map, nx, ny)) break; x = nx; y = ny; }
    const now = this.now(); S.x = x; S.y = y; S.dashLock = now + ms * 0.9; S.iframeUntil = Math.max(S.iframeUntil, now + iframes);
    if (sk?.stealth) S.stealthUntil = now + sk.stealth;
    S.conn.send({ t: 'dash', x, y, ms }); if (sk?.vfx) this.emit(S.map, { t: 'vfx', id: sk.vfx, x, y, sx: fromX, sy: fromY, a, r: sk.land?.radius ?? 0, col: sk.col ?? null }); else this.emit(S.map, { t: 'dashfx', who: S.id, x, y });
    if (sk?.vfxLand) this.later(ms * 0.85, () => { if (!S.dead) this.emit(S.map, { t: 'vfx', id: sk.vfxLand, x: S.x, y: S.y, a, r: sk.land?.radius ?? 2, col: sk.col ?? null }); });
    if (sk?.land) this.later(ms * 0.85, () => { if (!S.dead) this.playerAoe(S, { radius: sk.land.radius, power: rolls ? Math.max(1, Math.round(sk.land.power * this.diceMult(sk, rolls))) : sk.land.power, type: sk.type ?? 'blunt', stun: sk.land.stun, mag: sk.mag }, S.x, S.y); });
  },

  // ── damage ────────────────────────────────────────────────────────────────
  critChance(S, sk) {
    if (sk?.fx?.crit) return 1;
    const b = this.buffOf(S); if (sk?.fx?.critChance) return sk.fx.critChance + (b?.crit ?? 0);
    return Math.min(1, (S.P.classId === 'desperado' ? 0.35 : 0.08 + (S.P.classId === 'archer' || S.P.asc?.path === 'sniper' ? 0.06 : 0)) + (b?.crit ?? 0) + (S.rt.crit ?? 0));
  },
  damageMult(S, t, type, sk) {
    const now = this.now(), b = this.buffOf(S), st = S.rt.status;
    let mult = S.rt.dmgMult * (S.rt.wtype === type ? 1.1 : 1) * (1 + (b?.dmg ?? 0));
    if (t && t.vulnUntil > now) mult *= 1 + t.vuln;
    if (S.rt.passives.includes('cornered')) mult *= 1 + (1 - S.hp / S.rt.maxHp) * 0.6;
    if (st?.stacks && S.voidStacks) mult *= 1 + Math.min(S.voidStacks, st.stacks.max) * st.stacks.per;
    if (st?.goldPower) mult *= 1 + Math.min(st.goldPower.max, Math.floor(S.P.gilt / st.goldPower.step) * st.goldPower.per);
    if (sk?.exec && t?.maxHp && t.hp < t.maxHp * 0.3) mult *= 2;
    return mult;
  },
  hit(S, t, power, type, sk, dir) {
    if (t.isPlayer) return this.hitPlayerPvp(S, t.s, power, type, sk);
    const now = this.now(), d = ENEMIES[t.key] ?? {};
    let mult = this.damageMult(S, t, type, sk);
    const gap = (t.level ?? 0) - S.P.level; if (gap > 0) mult *= Math.max(0.12, 1 - 0.13 * gap);
    const crit = this.rng.chance(this.critChance(S, sk)); if (crit) mult *= 1.6;
    const mag = sk?.mag ?? 0, res = (ty) => (t.res?.[ty] ?? d.res?.[ty] ?? 1);
    let dmg;
    if (mag > 0) {
      dmg = (mag < 1 ? calcDamage(power * (1 - mag), S.rt.atk, t.def, res(type), mult) : 0) + calcDamage(power * mag, S.rt.atk, t.def * 0.5, res('arcane'), mult);
    } else dmg = calcDamage(power, S.rt.atk, t.def, res(type), mult);
    if (t.immune) dmg = Math.max(1, Math.round(dmg * 0.1));
    t.hp -= dmg; t.threat[S.id] = now; if (!t.target) t.target = S.id;
    t.flash = now;
    if (!t.boss || sk?.fx?.knock) { const k = (sk?.fx?.knock ?? 0.12) * (t.boss ? 0.15 : 1); const m = getMap(t.map); const nx = t.x + Math.cos(dir) * k, ny = t.y + Math.sin(dir) * k; if (!blockedAt(m, nx, ny, 0.3)) { t.x = nx; t.y = ny; } }
    this.emit(t.map, { t: 'dmg', x: t.x, y: t.y - 0.6, v: dmg, k: crit ? 'crit' : 'mob', ty: type });
    this.emit(t.map, { t: 'spark', x: t.x, y: t.y - 0.3, a: dir, ty: type, n: crit || sk?.hit ? 9 : 4 });
    const b = this.buffOf(S), ls = (sk?.fx?.lifesteal ?? 0) + (b?.ls ?? 0) + (S.rt.lifesteal ?? 0);
    if (ls) S.hp = Math.min(S.rt.maxHp, S.hp + dmg * ls);
    if (sk?.fx?.mpOnHit || S.rt.mpOnHit) S.mp = Math.min(S.rt.maxMp, S.mp + (sk?.fx?.mpOnHit ?? 0) + (S.rt.mpOnHit ?? 0));
    if (S.rt.slowOnHit && !t.boss) t.slowUntil = Math.max(t.slowUntil ?? 0, now + S.rt.slowOnHit);
    if (S.rt.stunChance && !t.boss && this.rng.chance(S.rt.stunChance)) t.stunUntil = Math.max(t.stunUntil ?? 0, now + 1000);
    if (sk?.stun && (sk.kind === 'melee' || sk.kind === 'proj')) t.stunUntil = Math.max(t.stunUntil ?? 0, now + sk.stun * (t.boss ? 0.5 : 1));
    if (sk?.slow) t.slowUntil = now + sk.slow;
    if (sk?.vulnHit) { t.vulnUntil = now + sk.vulnHit.ms; t.vuln = sk.vulnHit.v; }
    if (S.rt.status?.midas && this.rng.chance(S.rt.status.midas * 0.2)) { const g = this.rng.int(1, 4); S.P.gilt += g; }
    if (t.hp <= 0) this.killMob(t);
  },
  hitPlayerPvp(S, F, power, type, sk) {
    const rel = this.pvpRelation(S, F); if (!rel) return;
    let mult = this.damageMult(S, null, type, sk);
    const crit = this.rng.chance(this.critChance(S, sk)); if (crit) mult *= 1.6;
    if (rel !== 'duel') this.pvpTouch(S, F);
    this.hurtPlayer(F, calcDamage(power * 0.7, S.rt.atk, F.rt.def, 1, mult), { crit, by: S, rel });
  },
  // returns damage actually dealt. src: {mob} for reflect
  hurtPlayer(S, raw, o = {}) {
    const now = this.now(); if (S.dead || raw <= 0) return 0;
    if (now < S.iframeUntil) return 0;
    const st = S.rt.status;
    if (st?.phase && this.rng.chance(st.phase)) { this.emit(S.map, { t: 'dmg', x: S.x, y: S.y - 0.9, v: 'PHASE', k: 'phase' }); return 0; }
    // `raw` is the old-scale hit (what the attacker computed); the player's health pool is HP_SCALE times bigger, so the hit is too. Reflection
    // and thorns work on the old scale: they hurt monsters, whose health did not change. `hpUnits` = the caller already speaks in HP (a % of max health).
    const rawMob = o.hpUnits ? raw / HP_SCALE : raw; let dmg = o.hpUnits ? raw : raw * HP_SCALE;
    if (now < S.guardUntil) { dmg *= 1 - S.guardRed; if (o.mob && S.guardReflect) this.reflect(S, o.mob, rawMob * S.guardReflect); }
    if (now < S.tauntUntil) dmg *= 1 - S.tauntRed;
    const bf = this.buffOf(S); if (bf?.red) dmg *= 1 - bf.red;
    const th = (st?.thorns ?? 0) + (S.rt.thorns ?? 0); if (th && o.mob) this.reflect(S, o.mob, rawMob * th);
    if (S.shield > 0 && now < S.shieldUntil) { const ab = Math.min(S.shield, dmg); S.shield -= ab; dmg -= ab; }
    dmg = Math.round(dmg); S.lastHurt = now;
    if (dmg > 0 && st?.revive && S.hp - dmg <= 0 && now >= S.reviveAt) {
      S.reviveAt = now + st.revive; S.hp = Math.round(S.rt.maxHp * 0.5); S.iframeUntil = now + 1500;
      for (const m of this.mobs) if (m.map === S.map && !m.deadUntil && dist(m.x, m.y, S.x, S.y) < 6) m.stunUntil = now + 2500;
      this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 5, c: 'heal' }); this.emit(S.map, { t: 'boom', x: S.x, y: S.y, r: 5, ty: 'pierce', who: S.id });
      this.toast(S, 'The World Tree refuses to let you fall.', 'secret'); S.conn.send({ t: 'buff', id: 'revive_used', ms: st.revive }); return 0;
    }
    if (dmg > 0) { S.hp -= dmg; this.emit(S.map, { t: 'dmg', x: S.x, y: S.y - 0.9, v: dmg, k: o.crit ? 'crit' : 'player' }); S.conn.send({ t: 'hurt', v: dmg }); }
    if (S.hp <= 0) this.die(S, o.by, o.rel);
    return dmg;
  },
  reflect(S, mob, amt) { if (mob.deadUntil || mob.hp <= 0) return; const dmg = Math.max(1, Math.round(amt)); mob.hp -= dmg; mob.threat[S.id] = this.now(); this.emit(mob.map, { t: 'dmg', x: mob.x, y: mob.y - 0.6, v: dmg, k: 'mob' }); if (mob.hp <= 0) this.killMob(mob); },

  die(S, killer = null, rel = null) {
    const now = this.now();
    if (S.duel) return this.endDuel(S, this.sessions.get(S.duel));
    S.dead = true; S.deadUntil = now + DEAD_MS; S.hp = 0;
    const loss = rel ? 0 : Math.floor(S.P.gilt * 0.06); S.P.gilt -= loss; this.touch(S);
    if (rel && killer) this.pvpKill(killer, S, rel);
    S.conn.send({ t: 'died', loss, ms: DEAD_MS }); this.emit(S.map, { t: 'down', who: S.id, x: S.x, y: S.y });
    for (const m of this.mobs) if (m.target === S.id) { m.target = null; m.wind = null; }
    this.cancelTicket?.(S, true); S.gather = null; S.haggle = null;
  },
  respawn(S) {
    S.dead = false; S.hp = S.rt.maxHp; S.mp = S.rt.maxMp; S.iframeUntil = this.now() + 3000; S.immuneUntil = this.now() + 4000; S.lastHurt = 0;
    this.travel(S, 'town', 26.5, 19.5); S.conn.send({ t: 'respawned' });
  },

  // ── mobs ──────────────────────────────────────────────────────────────────
  spawnMobs() {
    for (const id of this.mapIds) {
      const map = getMap(id), zone = ZONES[id];
      for (const s of map.mobSpawns) this.mobs.push(this.newMob(id, zone, s.x + 0.5, s.y + 0.5, false));
      if (map.bossSpawn && zone.boss) this.mobs.push(this.newMob(id, zone, map.bossSpawn.x + 0.5, map.bossSpawn.y + 0.5, true));
      for (const e of map.eliteSpawns ?? []) if (zone.elite) this.mobs.push(this.newMob(id, zone, e.x + 0.5, e.y + 0.5, false, true));
    }
  },
  newMob(mapId, zone, x, y, boss, elite = false, force = null) {
    const m = { id: this.nextEnt++, map: mapId, x, y, hx: x, hy: y, boss, elite, deadUntil: 0, ...(force ?? {}) };
    this.rollMob(m, zone); return m;
  },
  rollMob(m, zone) {
    const key = m.forceKey ?? (m.boss ? zone.boss : m.elite ? zone.elite : this.rng.pick(zone.enemies)), level = m.forceLevel ?? zone.lvl + (m.boss ? 2 : m.elite ? 2 : this.rng.int(0, 2)), st = enemyStats(key, level);
    Object.assign(m, { key, level, name: m.elite ? `${ENEMIES[key].name} (Elite)` : null, hp: st.maxHp, maxHp: st.maxHp, atk: st.atk, def: st.def, speed: st.speed, moves: ENEMIES[key].moves.map((id) => MOVES[id]), x: m.hx, y: m.hy, target: null, wind: null, dash: null, cds: {}, stunUntil: 0, vulnUntil: 0, vuln: 0, tauntUntil: 0, threat: {}, deadUntil: 0, state: 'idle', wx: m.hx, wy: m.hy, wt: 0, flash: 0, enraged: false, bs: null, radius: RADIUS[ENEMIES[key].shape] ?? 0.4 });
    if (m.elite) { m.maxHp = m.hp = Math.round(m.maxHp * 1.8); m.atk += 3; }
  },
  becomeShade(m, S) {
    const st = shadeStats(S.P, m.level), mv = SHADE_MOVES[S.P.classId] ?? ['claw', 'flick'];
    Object.assign(m, { name: `Shade of ${S.P.name}`, hp: st.maxHp, maxHp: st.maxHp, atk: st.atk, def: st.def, speed: st.speed, moves: mv.map((id) => MOVES[id]), shadeOf: S.id });
  },

  killMob(mob) {
    if (mob.deadUntil) return;
    this.clearHazards(mob.id); mob.bs = null;
    const now = this.now(); mob.hp = 0; mob.deadUntil = now + (mob.boss ? 300000 : mob.elite ? 180000 : 22000 + this.rng.int(0, 15000)); mob.wind = null; mob.dash = null; mob.target = null;
    this.emit(mob.map, { t: 'mobdeath', x: mob.x, y: mob.y, k: mob.key, boss: mob.boss ? 1 : 0 });
    // contributors + nearby party members
    const who = new Set();
    for (const [id, t] of Object.entries(mob.threat)) { const S = this.sessions.get(id); if (S && S.map === mob.map && now - t < 30000) who.add(S); }
    for (const S of [...who]) { const pt = this.parties.get(S.partyId); if (pt) for (const id of pt.members) { const o = this.sessions.get(id); if (o && o.map === mob.map && dist(o.x, o.y, mob.x, mob.y) < 20) who.add(o); } }
    for (const S of who) {
      if (S.dead) continue;
      const rw = computeRewards([{ key: mob.key, level: mob.level }], S.P.level, this.rng);
      if (mob.elite) { rw.xp = Math.round(rw.xp * 2.5); rw.gold = Math.round(rw.gold * 2.5); }
      const gb = this.guildXpBonus?.(S.P) ?? 0; if (gb) rw.xp = Math.round(rw.xp * (1 + gb)); this.guildXp?.(S, mob.boss ? 12 : mob.elite ? 6 : 1);
      const tome = R.rollTome(S.P, mob.key, mob.boss || mob.elite, this.rng); if (tome) rw.drops[`tome_${tome}`] = 1;
      S.lastKillAt = now; if (S.rt.status?.stacks) S.voidStacks = Math.min(S.rt.status.stacks.max, (S.voidStacks ?? 0) + 1);
      this.questKill?.(S, mob); this.bountyEvent?.(S, 'kill', mob.key); if (mob.worldBoss) this.worldBossLoot?.(S); this.dungeonClear?.(S, mob); this.advKill?.(S, mob);
      const ups = R.applyKill(S.P, { rewards: rw, lowHp: S.hp < S.rt.maxHp * 0.25 });
      S.mp = Math.min(S.rt.maxMp, S.mp + 4);
      S.conn.send({ t: 'loot', xp: rw.xp, gold: rw.gold, drops: rw.drops, levelUps: ups, boss: mob.boss ? 1 : 0, x: mob.x, y: mob.y });
      if (ups.length) { this.recalc(S); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp; }
      this.afterChange(S);
    }
    if (mob.temp && !mob.worldBoss) this.mobs = this.mobs.filter((x) => x !== mob);
  },

  mobTarget(mob, nw) {
    const map = getMap(mob.map);
    let S = mob.target ? this.sessions.get(mob.target) : null;
    if (S && (S.map !== mob.map || S.dead || (mob.tauntUntil <= nw && (S.stealthUntil > nw || inSafeZone(map, S.x, S.y))) || dist(S.x, S.y, mob.x, mob.y) > DROP_DIST)) { S = null; mob.target = null; }
    if (!S) {
      const ar = (mob.boss ? 8 : 5.4) + (realmOf(mob.map) === 'hollow' ? 1 : 0); let best = ar;
      for (const o of this.sessions.values()) {
        if (o.map !== mob.map || o.dead || o.immuneUntil > nw || o.stealthUntil > nw || inSafeZone(map, o.x, o.y)) continue;
        const d = dist(o.x, o.y, mob.x, mob.y); if (d < best) { best = d; S = o; }
      }
      if (S) { mob.target = S.id; if (ENEMIES[mob.key].mirror && !mob.shadeOf) this.becomeShade(mob, S); }
    }
    return S;
  },

  tickMobs(dt, nw) {
    const active = new Set(); for (const S of this.sessions.values()) active.add(S.map);   // maps nobody is on do not need to think (the world has hundreds of them)
    for (const mob of this.mobs) {
      if (mob.deadUntil) { if (nw >= mob.deadUntil) this.rollMob(mob, ZONES[mob.map]); continue; }
      if (!active.has(mob.map)) { if (mob.hp < mob.maxHp) mob.hp = mob.maxHp; continue; }
      const map = getMap(mob.map);
      // healing: nothing for 10 s after the last damage, then a slow 2% of max HP per second
      if (mob.hp > 0 && mob.hp < mob.maxHp && nw - (mob.hurtAt ?? 0) > MOB_HEAL_DELAY) mob.hp = Math.min(mob.maxHp, mob.hp + mob.maxHp * MOB_HEAL_RATE * dt);
      if (mob.hp < (mob.lastHp ?? mob.hp)) mob.hurtAt = nw; mob.lastHp = mob.hp;
      if (mob.stunUntil > nw) continue;
      if (mob.boss) this.tickBossScript(mob, nw);
      if (mob.boss && !mob.enraged && mob.hp < mob.maxHp * 0.5) { mob.enraged = true; mob.speed *= 1.15; this.emit(mob.map, { t: 'aura', x: mob.x, y: mob.y, r: 3, c: 'rage' }); }
      // dash in progress
      if (mob.dash) {
        const d = mob.dash; const step = d.speed * dt;
        const nx = mob.x + Math.cos(d.a) * step, ny = mob.y + Math.sin(d.a) * step;
        if (nw >= d.until || blockedAt(map, nx, ny, 0.3)) mob.dash = null; else { mob.x = nx; mob.y = ny; for (const S of this.sessions.values()) if (S.map === mob.map && !S.dead && !d.hit.has(S.id) && dist(S.x, S.y, mob.x, mob.y) < 0.85) { d.hit.add(S.id); this.hurtPlayer(S, Math.round(mobHit(d.power, mob.atk, S.rt.def) * MOB_DMG * this.gapMult(mob, S)), { mob }); } }
        continue;
      }
      // winding up an attack?
      if (mob.wind) { if (nw >= mob.wind.at) this.resolveMobMove(mob, nw); continue; }
      if (mob.bs && nw < mob.bs.busy) continue;                                   // channelling a boss pattern: it holds its ground
      const S = this.mobTarget(mob, nw);
      const home = dist(mob.x, mob.y, mob.hx, mob.hy);
      if (!S) {
        mob.target = null;
        if (home > 0.5) this.stepMob(mob, map, ang(mob.x, mob.y, mob.hx, mob.hy), mob.speed * 1.3 * dt);   // nobody in reach any more: walk back home
        else if (nw > mob.wt) { mob.wt = nw + this.rng.int(1500, 4000); mob.wx = mob.hx + this.rng.range(-3, 3); mob.wy = mob.hy + this.rng.range(-3, 3); }
        else if (!mob.boss && dist(mob.wx, mob.wy, mob.x, mob.y) > 0.2) this.stepMob(mob, map, ang(mob.x, mob.y, mob.wx, mob.wy), 0.9 * dt);
        continue;
      }
      const d = dist(S.x, S.y, mob.x, mob.y), a = ang(mob.x, mob.y, S.x, S.y), info = ENEMIES[mob.key];
      // pick an attack if one is ready and in range
      const ready = mob.moves.filter((mv) => (mob.cds[mob.moves.indexOf(mv)] ?? 0) <= nw && this.moveInRange(mv, d));
      if (ready.length && this.rng.chance(0.18 + dt * 2)) { this.startMove(mob, this.rng.pick(ready), S, a, nw); continue; }
      // otherwise position: close in, or keep distance for ranged units
      const kite = info.kite ?? 0, gap = Math.max(0, mob.level - S.P.level);
      // Being plinked from range: after a moment of that, the enemy breaks into a sprint to close the gap (melee only).
      if (!kite && d > 3.2 && nw - (mob.threat[S.id] ?? -1e9) < 4000) {
        mob.farSince ??= nw;
        if (nw - mob.farSince > 1400 && nw >= (mob.sprintCd ?? 0)) { mob.sprintUntil = nw + 1800; mob.sprintCd = nw + 6000; mob.farSince = 0; this.emit(mob.map, { t: 'dashfx', who: `m${mob.id}`, x: mob.x, y: mob.y }); }
      } else mob.farSince = 0;
      const sp = mob.speed * (1 + Math.min(0.5, 0.04 * gap)) * (mob.sprintUntil > nw ? 1.9 : 1) * (mob.slowUntil > nw ? 0.5 : 1);
      if (kite && d < kite - 0.4) this.stepMob(mob, map, a + Math.PI, sp * dt);
      else if (d > (kite || 1.0)) this.stepMob(mob, map, a, sp * dt);
    }
  },
  anyoneOn(mapId) { for (const S of this.sessions.values()) if (S.map === mapId) return true; return false; },
  // Steer around obstacles: straight line first; if blocked, commit to ONE side (remembered in mob.turn) and
  // slide along the obstacle until the straight path is clear again, so mobs never dither in front of a prop.
  stepMob(mob, map, a, step) {
    const tryDir = (ang) => { const nx = mob.x + Math.cos(ang) * step, ny = mob.y + Math.sin(ang) * step; if (!blockedAt(map, nx, ny, 0.3)) { mob.x = nx; mob.y = ny; return true; } return false; };
    if (tryDir(a)) { mob.turn = 0; return; }
    if (!mob.turn) mob.turn = this.rng.chance(0.5) ? 1 : -1;
    for (const off of [0.8, 1.4, 2.0, 2.7]) if (tryDir(a + mob.turn * off)) return;
    mob.turn = -mob.turn;                                 // dead end on this side: try the other next time
    for (const off of [0.8, 1.4, 2.0, 2.7]) if (tryDir(a + mob.turn * off)) return;
  },
  moveInRange(mv, d) {
    if (mv.kind === 'melee') return d <= mv.range + 0.5;
    if (mv.kind === 'aoe') return mv.at === 'self' ? d <= mv.radius + 0.6 : d <= mv.range;
    return d <= mv.range;
  },
  startMove(mob, mv, S, a, nw) {
    const speedUp = mob.enraged ? 0.75 : 1;
    mob.cds[mob.moves.indexOf(mv)] = nw + mv.cd * speedUp + mv.windup;
    mob.wind = { mv, a, at: nw + mv.windup * (mob.enraged ? 0.85 : 1), t0: nw, tx: S.x, ty: S.y, dur: mv.windup };
  },
  resolveMobMove(mob, nw) {
    const { mv, a, tx, ty } = mob.wind; mob.wind = null;
    const players = [...this.sessions.values()].filter((S) => S.map === mob.map && !S.dead);
    const pw = mv.power * (ENEMIES[mob.key]?.pwr ?? 1), dmgFor = (S) => Math.round(mobHit(pw, mob.atk, S.rt.def) * MOB_DMG * this.gapMult(mob, S));
    if (mv.kind === 'melee') {
      this.emit(mob.map, { t: 'slash', x: mob.x, y: mob.y, a, range: mv.range, arc: mv.arc, ty: mv.type, who: `m${mob.id}` });
      for (const S of players) { const d = dist(S.x, S.y, mob.x, mob.y); if (d <= mv.range + 0.35 && (angDiff(ang(mob.x, mob.y, S.x, S.y), a) <= rad(mv.arc) / 2 || d < 0.6)) this.hurtPlayer(S, dmgFor(S), { mob }); }
    } else if (mv.kind === 'aoe') {
      const cx = mv.at === 'self' ? mob.x : tx, cy = mv.at === 'self' ? mob.y : ty;
      this.emit(mob.map, { t: 'boom', x: cx, y: cy, r: mv.radius, ty: mv.type, who: `m${mob.id}` });
      for (const S of players) if (dist(S.x, S.y, cx, cy) <= mv.radius + 0.3) this.hurtPlayer(S, dmgFor(S), { mob });
    } else if (mv.kind === 'proj') {
      const n = mv.count ?? 1, sp = mv.spread ?? 0;
      for (let i = 0; i < n; i++) { const off = sp >= 360 ? (i / n) * Math.PI * 2 : n === 1 ? 0 : rad(sp) * (i / (n - 1) - 0.5); this.spawnProj({ map: mob.map, x: mob.x, y: mob.y, a: a + off, speed: mv.speed, r: mv.radius, power: mv.power * (ENEMIES[mob.key]?.pwr ?? 1), type: mv.type, range: mv.range, pierce: 0, aoe: 0, owner: { k: 'm', id: mob.id, atk: mob.atk } }); }
    } else if (mv.kind === 'dash') {
      mob.dash = { a, speed: mv.speed, until: nw + (mv.dist / mv.speed) * 1000, power: mv.power * (ENEMIES[mob.key]?.pwr ?? 1), hit: new Set() };
    }
  },

  // ── projectiles & zones ───────────────────────────────────────────────────
  tickProjectiles(dt, nw) {
    const keep = [];
    for (const p of this.projs) {
      const map = getMap(p.map); p.ttl -= dt; if (p.ttl <= 0) { this.projEnd(p); if (p.aoe) this.projAoe(p); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (blockedAt(map, p.x, p.y, 0.05)) { this.projEnd(p); if (p.aoe) this.projAoe(p); continue; }
      let dead = false;
      if (p.owner.k === 'p') {
        const S = this.sessions.get(p.owner.id); if (!S) continue;
        for (const t of this.targetsFor(S)) {
          if (p.hit.has(t.isPlayer ? t.s.id : t.id) || dist(p.x, p.y, t.x, t.y) > p.r + t.radius) continue;
          p.hit.add(t.isPlayer ? t.s.id : t.id); this.hit(S, t, p.power, p.type, p.sk, ang(p.x - p.vx, p.y - p.vy, p.x, p.y));
          if (p.aoe) { this.projEnd(p); this.projAoe(p); dead = true; break; }
          if (p.pierce-- <= 0) { this.projEnd(p); dead = true; break; }
        }
      } else {
        for (const S of this.sessions.values()) {
          if (S.map !== p.map || S.dead || dist(p.x, p.y, S.x, S.y) > p.r + 0.3 || nw < S.iframeUntil) continue;
          const mob = this.mobs.find((m) => m.id === p.owner.id);
          this.hurtPlayer(S, Math.round(mobHit(p.power, p.owner.atk, S.rt.def) * MOB_DMG * 0.9 * this.gapMult(mob, S)), { mob }); dead = true; break;
        }
      }
      if (!dead) keep.push(p);
    }
    this.projs = keep;
  },
  projEnd(p) { if (p.sk?.vfxEnd) this.emit(p.map, { t: 'vfx', id: p.sk.vfxEnd, who: p.owner.id, follow: false, x: p.x, y: p.y, a: Math.atan2(p.vy, p.vx), r: p.aoe || p.sk.radius || 0, col: p.sk.col ?? null }); },
  projAoe(p) {
    const S = this.sessions.get(p.owner.id); if (!S) return;
    if (!p.sk?.quiet) this.emit(p.map, { t: 'boom', x: p.x, y: p.y, r: p.aoe, ty: p.type, who: S.id });
    for (const t of this.targetsFor(S)) if (dist(p.x, p.y, t.x, t.y) <= p.aoe + t.radius && !p.hit.has(t.isPlayer ? t.s.id : t.id)) this.hit(S, t, p.power * 0.6, p.type, p.sk, 0);
  },
  tickZones(nw) {
    this.zones = this.zones.filter((z) => {
      if (nw >= z.until) return false;
      const S = this.sessions.get(z.owner);
      if (z.trap) {
        if (!S || nw < z.armedAt) return !!S;
        const near = (m) => m.map === z.map && !m.deadUntil && m.hp > 0 && dist(z.x, z.y, m.x, m.y) <= z.r + m.radius;
        if (!this.mobs.some(near)) return true;
        this.emit(z.map, { t: 'boom', x: z.x, y: z.y, r: z.r, ty: z.type, who: S.id });
        for (const m of this.mobs.filter(near)) { this.hit(S, m, z.power, z.type, z.sk, 0); m.stunUntil = nw + z.stun * (m.boss ? 0.5 : 1); }
        return false;
      }
      if (nw >= z.next) {
        z.next += z.every;
        if (S && z.field) {
          for (const T of [S, ...this.allies(S, 99)]) if (T.map === z.map && !T.dead && dist(T.x, T.y, z.x, z.y) <= z.r) this.healPlayer(T, T.rt.maxHp * z.field.heal, S);
          if (z.power) for (const t of this.targetsFor(S)) if (!t.isPlayer && dist(z.x, z.y, t.x, t.y) <= z.r + t.radius) this.hit(S, t, z.power, z.type ?? 'arcane', z.sk, 0);
        } else if (S) for (const t of this.targetsFor(S)) if (!t.isPlayer && dist(z.x, z.y, t.x, t.y) <= z.r + t.radius) this.hit(S, t, z.power, z.type, z.sk, 0);
      }
      return true;
    });
  },

  // ── per-player upkeep ─────────────────────────────────────────────────────
  tickPlayers(dt, nw) {
    for (const S of this.sessions.values()) {
      if (S.dead) { if (nw >= S.deadUntil) this.respawn(S); continue; }
      const map = getMap(S.map), safe = inSafeZone(map, S.x, S.y), hollow = realmOf(S.map) === 'hollow', st = S.rt.status, bf = this.buffOf(S);
      if (!S.duel && !this.inCombat(S)) S.hp = Math.min(S.rt.maxHp, S.hp + S.rt.maxHp * (safe ? 0.08 : 0.015) * dt);
      if (st?.regen) S.hp = Math.min(S.rt.maxHp, S.hp + S.rt.maxHp * st.regen * dt);
      if (bf?.regen) S.hp = Math.min(S.rt.maxHp, S.hp + S.rt.maxHp * bf.regen * dt);
      if (S.rt.regen) S.hp = Math.min(S.rt.maxHp, S.hp + S.rt.maxHp * S.rt.regen * dt);
      if (hollow && !safe && !S.rt.taintImmune) S.mp = Math.max(0, S.mp - 1.3 * dt);
      else S.mp = Math.min(S.rt.maxMp, S.mp + (S.rt.mpRegen * (bf?.mpRegen ?? 1) + (safe ? 4 : 0)) * dt);
      if (S.shieldUntil && nw > S.shieldUntil) S.shield = 0;
      if (st?.stacks && S.voidStacks && nw - S.lastKillAt > st.stacks.decay) S.voidStacks = 0;
      if (st?.aura && nw >= S.auraNext && !safe) {
        S.auraNext = nw + 500;
        for (const m of this.mobs) if (m.map === S.map && !m.deadUntil && m.hp > 0 && dist(m.x, m.y, S.x, S.y) <= st.aura.r + m.radius) { const d = Math.max(1, Math.round(st.aura.dps * 0.5)); m.hp -= d; m.threat[S.id] = nw; if (!m.target) m.target = S.id; this.emit(m.map, { t: 'dmg', x: m.x, y: m.y - 0.5, v: d, k: 'mob' }); if (m.hp <= 0) this.killMob(m); }
      }
      if (S.duel) { const f = this.sessions.get(S.duel); if (!f || f.map !== S.map || dist(f.x, f.y, S.x, S.y) > 30) this.endDuel(S, f, true); }
    }
  },
  tickCombat(dt, nw) {
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].at <= nw) { const t = this.timers.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error(e); } }
    this.tickPlayers(dt, nw); this.tickMobs(dt, nw); this.tickProjectiles(dt, nw); this.tickZones(nw); this.tickHazards(nw);
  },

  // ── duels (consensual PvP) ────────────────────────────────────────────────
  on_duel_challenge(S, m) {
    const o = this.sessionByName(m.to);
    if (!o || o === S || o.map !== S.map || dist(o.x, o.y, S.x, S.y) > 12) return this.toast(S, 'They must be nearby.', 'bad');
    if (S.duel || o.duel || S.dead || o.dead || S.tradeId || o.tradeId) return this.toast(S, 'One of you is busy.', 'bad');
    this.invites.set(`duel:${o.id}`, { from: S.id, at: this.now() });
    o.conn.send({ t: 'invite', kind: 'duel', from: S.P.name }); this.toast(S, `Duel challenge sent to ${o.P.name}.`);
  },
  on_duel_accept(S) {
    const inv = this.invites.get(`duel:${S.id}`); if (!inv) return; this.invites.delete(`duel:${S.id}`);
    const A = this.sessions.get(inv.from); if (!A || A.duel || S.duel || A.dead || S.dead || A.map !== S.map) return;
    for (const X of [A, S]) { X.hp = X.rt.maxHp; X.mp = X.rt.maxMp; X.shield = 0; }
    A.duel = S.id; S.duel = A.id;
    for (const X of [A, S]) X.conn.send({ t: 'duel', foe: X === A ? S.P.name : A.P.name, on: true });
    this.systemChat(` ${A.P.name} and ${S.P.name} begin a duel!`);
  },
  endDuel(loser, winner, aborted = false) {
    if (!loser?.duel && !winner?.duel) return;
    const ls = loser, ws = winner;
    for (const X of [ls, ws]) if (X) { X.duel = null; X.hp = X.rt.maxHp; X.mp = X.rt.maxMp; X.iframeUntil = this.now() + 1500; X.conn.send({ t: 'duel', on: false, won: !aborted && X === ws }); }
    if (!aborted && ws && ls) { ws.P.stats.duelWins++; ls.P.stats.duelLosses++; this.systemChat(` ${ws.P.name} defeated ${ls.P.name} in a duel.`); this.afterChange(ws); this.afterChange(ls); }
  },
};
