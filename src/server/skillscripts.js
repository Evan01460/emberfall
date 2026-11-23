// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ADVANCEMENT SKILLS (server) — the engine for `kind: 'script'` skills (data in src/advskills.js). A script skill is a list of STEPS, each a
// different mechanic; most of them leave something on the ground or in the air (a "pz": blades, rings, beams, a vortex, a wall, a zone, a bomb
// on an enemy) or on the battlefield (a "pet": a familiar or a totem) that the world keeps ticking. Damage goes through the same hit() as every
// other skill, so crits, resistances, level gaps, buffs and life steal all apply.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { getMap, blockedAt, dist } from '../world.js';
import { hazHits, orbPos } from './bosses.js';

const TAU = Math.PI * 2, rad = (d) => d;
const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FOLLOW = new Set(['orbit', 'beams', 'zone']);

export const scriptMethods = {
  initScripts() { this.pz = []; this.pets = []; },

  // entry from resolveSkill
  runScript(S, sk, a, tx, ty, rolls = null) {
    const nw = this.now(), cur = this.aimPoint(S, { ...sk, at: 'cursor', range: sk.range ?? 10 }, tx, ty), state = { mult: 1, face: 0 };
    if (rolls) { state.face = rolls[0]; state.mult = this.diceMult(sk, rolls); }          // the Desperado's die, already rolled and shown by cast()
    const ctx = { a, cx: cur[0], cy: cur[1], sx: S.x, sy: S.y, state };
    if (!sk.quiet) this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 1.6, c: 'rage' });
    // a step may repeat (`rep: { n, gap, turn }`): n times, gap ms apart, each aimed `turn` radians further round — spirals, sweeps, volleys
    for (const st of sk.steps ?? []) { const rep = st.rep ?? { n: 1, gap: 0, turn: 0 };
      for (let k = 0; k < rep.n; k++) this.later((st.at ?? 0) + k * rep.gap, () => { if (!S.dead && this.sessions.get(S.id) === S) this.scriptStep(S, sk, st, { ...ctx, sx: S.x, sy: S.y, a: ctx.a + k * (rep.turn ?? 0), k }); }); }
    void nw;
  },
  origin(S, st, ctx) { return st.from === 'cursor' ? [ctx.cx, ctx.cy] : [S.x, S.y]; },
  addPz(S, sk, o) {
    const nw = this.now(), ws = nw + (o.delay ?? 0), we = ws + (o.warn ?? 0), pz = { id: this.nextEnt++, map: S.map, owner: S.id, theme: sk.theme, col: sk.col, sk, ws, we, ae: we + (o.act ?? 300), hit: new Set(), next: we, ...o };
    this.pz.push(pz); return pz;
  },
  mobsNear(S, x, y, r) { return this.targetsFor(S).filter((t) => dist(x, y, t.x, t.y) <= r + (t.radius ?? 0.4)); },

  scriptStep(S, sk, st, ctx) {
    const nw = this.now();
    if (st.minFace && ctx.state.face < st.minFace) return;       // a step that only happens on a high roll
    if (st.roll && ctx.state.mult !== 1) { const m = ctx.state.mult; st = { ...st, power: st.power != null ? st.power * m : st.power, ...(st.then ? { then: { ...st.then, power: st.then.power * m } } : {}), ...(st.finisher ? { finisher: { ...st.finisher, power: st.finisher.power * m } } : {}) }; }
    const add = (o) => this.addPz(S, sk, { steal: st.steal ?? 0, ...o });
    switch (st.t) {
      case 'orbit': { const pz = add({ k: 'orbit', x: S.x, y: S.y, n: st.n, R: st.R, a: 0, spin: st.spin, r: st.r, power: st.power, tick: st.tick, warn: 250, act: st.dur, heal: st.heal ?? 0, follow: true }); void pz; break; }
      case 'rings': { const [ox, oy] = this.origin(S, st, ctx); for (let i = 0; i < st.n; i++) add({ k: 'ring', x: ox, y: oy, r: 16, speed: st.speed, w: st.w, power: st.power, delay: i * st.gap, warn: st.warn ?? 200, act: 3200, follow: st.from === 'self' && false }); break; }
      case 'beams': { const [ox, oy] = this.origin(S, st, ctx); add({ k: 'beams', x: ox, y: oy, a: ctx.a, n: st.n, len: st.len, w: st.w, spin: st.spin, power: st.power, tick: st.tick, warn: st.warn ?? 300, act: st.dur, follow: !!st.follow }); break; }
      case 'rain': { const [ox, oy] = this.origin(S, st, ctx); const pa = ang(S.x, S.y, ctx.cx, ctx.cy), pl = st.path ? Math.min(st.path, Math.max(3, dist(S.x, S.y, ctx.cx, ctx.cy))) : 0; for (let i = 0; i < st.n; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * (st.path ? 0.9 : st.area), bx = st.path ? S.x + Math.cos(pa) * (1.8 + (pl - 1.8) * ((i + 1) / st.n)) : ox, by = st.path ? S.y + Math.sin(pa) * (1.8 + (pl - 1.8) * ((i + 1) / st.n)) : oy; add({ k: 'circle', x: bx + Math.cos(a) * d, y: by + Math.sin(a) * d, r: st.r, power: st.power, delay: (i / st.n) * st.over, warn: st.warn, act: 260, fall: st.fall, stun: st.stun ?? 0, healAllies: st.healAllies ?? 0 }); } break; }
      case 'lanes': {
        const foes = this.targetsFor(S).filter((t) => dist(S.x, S.y, t.x, t.y) < 16).sort((p, q) => dist(S.x, S.y, p.x, p.y) - dist(S.x, S.y, q.x, q.y));
        const jack = new Set(); if (st.jackpot) while (jack.size < Math.min(st.n, st.jackpot.n)) jack.add(Math.floor(Math.random() * st.n));   // a few lanes are loaded
        for (let i = 0; i < st.n; i++) {
          let a = ctx.a; if (st.aim === 'mobs') { const t = foes[i % Math.max(1, foes.length)]; if (t) a = ang(S.x, S.y, t.x, t.y); else a = ctx.a + (Math.random() - 0.5) * 1.2; }
          else if (st.aim === 'fan') a = ctx.a + (st.n === 1 ? 0 : (i / (st.n - 1) - 0.5) * st.spread); else if (st.aim === 'cursor') a = ang(S.x, S.y, ctx.cx, ctx.cy); else if (st.aim === 'around') a = ctx.a + (i / st.n) * TAU;
          const big = jack.has(i);
          add({ k: 'line', x: S.x, y: S.y, a, len: st.len, w: st.w * (big ? 1.8 : 1), power: st.power * (big ? st.jackpot.mult : 1), big: big ? 1 : 0, suit: i % 4, delay: i * st.gap, warn: st.warn, act: 240, stun: st.stun ?? 0 });
        }
        break;
      }
      case 'chain': {
        const first = this.targetsFor(S).filter((t) => dist(S.x, S.y, t.x, t.y) < 13).sort((p, q) => dist(ctx.cx, ctx.cy, p.x, p.y) - dist(ctx.cx, ctx.cy, q.x, q.y))[0]; if (!first) break;
        const done = new Set(); let t = first, px = S.x, py = S.y, power = st.power;
        for (let j = 0; j < st.jumps && t; j++) {
          const tt = t, x0 = px, y0 = py, pw = power, jj = j; done.add(tt.isPlayer ? tt.s.id : tt.id);
          this.later(jj * 100, () => { if (tt.hp <= 0 || tt.deadUntil) return; this.emit(S.map, { t: 'chainfx', x0, y0, x1: tt.x, y1: tt.y, th: sk.theme, col: sk.col });
            this.hit(S, tt, pw, sk.type ?? 'arcane', sk, ang(x0, y0, tt.x, tt.y)); if (st.steal) this.healPlayer(S, S.rt.maxHp * st.steal / Math.max(1, st.jumps) * 1.4); if (st.vuln && !tt.isPlayer) { tt.vulnUntil = this.now() + st.vuln.ms; tt.vuln = st.vuln.v; }
            if (st.blast) { this.emit(S.map, { t: 'boom', x: tt.x, y: tt.y, r: st.blast, ty: sk.type, who: S.id }); for (const o of this.mobsNear(S, tt.x, tt.y, st.blast)) if (o !== tt) this.hit(S, o, pw * 0.6, sk.type ?? 'blunt', sk, 0); } });
          px = tt.x; py = tt.y; power *= st.falloff ?? 0.92;
          t = this.targetsFor(S).filter((o) => !done.has(o.isPlayer ? o.s.id : o.id) && dist(px, py, o.x, o.y) <= st.range).sort((p, q) => dist(px, py, p.x, p.y) - dist(px, py, q.x, q.y))[0];
        }
        break;
      }
      case 'vortex': { const [ox, oy] = this.origin(S, st, ctx); add({ k: 'vortex', x: ox, y: oy, r: st.r, pull: st.pull, power: st.power, tick: st.tick, then: st.then, warn: 100, act: st.dur }); break; }
      case 'leap': {
        const a = ctx.a; this.dash(S, a, st.dist, 300, 450, null); this.emit(S.map, { t: 'dashfx', who: S.id, x: S.x, y: S.y });
        this.later(300, () => { if (S.dead) return; this.emit(S.map, { t: 'boom', x: S.x, y: S.y, r: st.r, ty: sk.type, who: S.id }); this.emit(S.map, { t: 'shake', who: S.id, m: 1 });
          for (const t of this.mobsNear(S, S.x, S.y, st.r)) { this.hit(S, t, st.power, sk.type ?? 'blunt', sk, ang(S.x, S.y, t.x, t.y)); if (st.stun && !t.isPlayer) t.stunUntil = Math.max(t.stunUntil ?? 0, this.now() + st.stun * (t.boss ? 0.4 : 1)); }
          for (let i = 0; i < (st.rings ?? 0); i++) add({ k: 'ring', x: S.x, y: S.y, r: 12, speed: 6.5, w: 1.2, power: st.power * 0.5, delay: 200 + i * 450, warn: 0, act: 2400 }); });
        break;
      }
      case 'blink': {
        const foes = this.targetsFor(S).filter((t) => dist(S.x, S.y, t.x, t.y) < 14).sort((p, q) => dist(S.x, S.y, p.x, p.y) - dist(S.x, S.y, q.x, q.y)), t = foes[0]; if (!t) { this.toast(S, 'No target in reach.', 'bad'); break; }
        const away = ang(t.x, t.y, S.x, S.y), map = getMap(S.map); let bx = t.x - Math.cos(away) * 1.4, by = t.y - Math.sin(away) * 1.4; if (blockedAt(map, bx, by)) { bx = t.x + Math.cos(away) * 1.4; by = t.y + Math.sin(away) * 1.4; if (blockedAt(map, bx, by)) { bx = t.x; by = t.y; } }
        this.emit(S.map, { t: 'blinkfx', x0: S.x, y0: S.y, x1: bx, y1: by, th: sk.theme, col: sk.col }); S.x = bx; S.y = by; S.dashLock = this.now() + 120; S.iframeUntil = Math.max(S.iframeUntil, this.now() + (st.hits * st.interval) + 500); S.conn.send({ t: 'dash', x: bx, y: by, ms: 80 });
        for (let i = 0; i < st.hits; i++) this.later(120 + i * st.interval, () => { if (S.dead || t.hp <= 0 || t.deadUntil) return; const a = ang(S.x, S.y, t.x, t.y); this.emit(S.map, { t: 'slash', x: S.x, y: S.y, a: a + (i % 2 ? 0.5 : -0.5), range: 2.4, arc: 160, ty: sk.type, who: S.id, step: i % 2, dir: i % 2 ? 1 : -1, big: 0, mag: 0 }); this.hit(S, t, st.power, sk.type ?? 'slash', sk, a); });
        this.later(120 + st.hits * st.interval + 80, () => { if (S.dead) return; const f = st.finisher; if (f) { this.emit(S.map, { t: 'boom', x: t.x, y: t.y, r: f.r, ty: sk.type, who: S.id }); this.emit(S.map, { t: 'shake', who: S.id, m: 1 }); for (const o of this.mobsNear(S, t.x, t.y, f.r)) this.hit(S, o, f.power, sk.type ?? 'arcane', sk, ang(t.x, t.y, o.x, o.y)); } if (st.heal) this.healPlayer(S, S.rt.maxHp * st.heal); });
        break;
      }
      case 'summon': {
        for (let i = 0; i < st.n; i++) this.pets.push({ id: this.nextEnt++, map: S.map, owner: S.id, kind: st.kind, x: S.x + Math.cos(i * 2.1) * 1.2, y: S.y + Math.sin(i * 2.1) * 1.2, until: nw + st.dur, every: st.every, power: st.power, range: st.range, next: nw + 600 + i * 250, sk, th: sk.theme, col: st.col ?? sk.col, fixed: false, face: 0, melee: st.melee ?? (st.kind === 'wolf' || st.kind === 'mule'), aoe: st.aoe ?? 0, vi: st.vi ?? null, aura: st.aura ?? null, r: st.aura ? st.r ?? 5 : 0, born: nw, pullR: st.pullR ?? 0, steal: st.steal ?? 0 });
        this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 2.2, c: 'ward' }); break;
      }
      case 'totem': {
        const [ox, oy] = this.origin(S, st, ctx); this.pets.push({ id: this.nextEnt++, map: S.map, owner: S.id, kind: st.kind, x: ox, y: oy, until: nw + st.dur, every: st.every, power: st.power ?? 0, range: st.range ?? st.r ?? 6, r: st.r ?? 6, aura: st.aura ?? null, next: nw + 400, sk, th: sk.theme, col: st.col ?? sk.col, fixed: true, face: 0, born: nw, melee: false, aoe: st.aoe ?? 0, vi: st.vi ?? null, pullR: st.pullR ?? 0, steal: st.steal ?? 0 });
        this.emit(S.map, { t: 'aura', x: ox, y: oy, r: 2.2, c: 'ward' }); break;
      }
      case 'wall': { const dx = Math.cos(ctx.a), dy = Math.sin(ctx.a); add({ k: 'wall', x: S.x + dx * 1.3, y: S.y + dy * 1.3, a: ctx.a, span: st.span, w: st.w, speed: st.speed, power: st.power, push: st.push ?? 0, gapAt: 0, gapW: 0, warn: 100, act: st.dur }); break; }
      case 'bombs': {
        const foes = this.targetsFor(S).filter((t) => dist(S.x, S.y, t.x, t.y) < 12).sort((p, q) => (q.maxHp ?? 0) - (p.maxHp ?? 0) || dist(S.x, S.y, p.x, p.y) - dist(S.x, S.y, q.x, q.y)).slice(0, st.count);
        for (const t of foes) add({ k: 'bomb', x: t.x, y: t.y, mobId: t.isPlayer ? null : t.id, r: st.r, power: st.power, cascade: st.cascade ?? 0, warn: st.delay, act: 400 });
        if (!foes.length) this.toast(S, 'Nothing to mark.', 'bad'); break;
      }
      case 'zone': { const [ox, oy] = this.origin(S, st, ctx); add({ k: 'zone', x: ox, y: oy, r: st.r, effect: st.effect, tick: st.tick, heal: st.heal ?? 0, power: st.power ?? 0, red: st.red ?? 0, reflect: st.reflect ?? 0, vuln: st.vuln ?? 0, hold: st.hold ?? 0, then: st.then, warn: 200, act: st.dur, follow: !!st.follow }); break; }
      case 'nova': { const [ox, oy] = this.origin(S, st, ctx); this.emit(S.map, { t: 'boom', x: ox, y: oy, r: st.r, ty: sk.type, who: S.id }); this.emit(S.map, { t: 'shake', who: S.id, m: 1 });
        for (const t of this.mobsNear(S, ox, oy, st.r)) { this.hit(S, t, st.power, sk.type ?? 'arcane', sk, ang(ox, oy, t.x, t.y)); if (st.stun && !t.isPlayer) t.stunUntil = Math.max(t.stunUntil ?? 0, this.now() + st.stun * (t.boss ? 0.4 : 1)); if (st.vuln && !t.isPlayer) { t.vulnUntil = nw + st.vuln.ms; t.vuln = st.vuln.v; } }
        if (st.heal) this.healPlayer(S, S.rt.maxHp * st.heal, S); break; }
      case 'buff': { const targets = [S, ...(st.radius ? this.allies(S, st.radius) : [])]; for (const T of targets) { T.buff = { id: sk.id, until: nw + st.dur, ...st.buff }; T.conn.send({ t: 'buff', id: sk.id, ms: st.dur }); } if (st.shield) { S.shield = (st.shield + S.P.level * 4) * 10; S.shieldUntil = nw + st.dur; } break; }
      case 'heal': { for (const T of [S, ...this.allies(S, st.radius ?? 8)]) this.healPlayer(T, T.rt.maxHp * st.pct, S); break; }
      case 'shots': {   // real projectiles through the ordinary projectile system (so pierce, blasts, crits, art all work)
        const pseudo = { ...sk, kind: 'proj', count: st.countRoll ? Math.max(1, ctx.state.face || 1) : st.count ?? 1, spread: st.spread ?? 0, speed: st.speed ?? 16, range: st.range ?? 11, radius: st.radius ?? 0.3, power: st.power, pierce: st.pierce ?? 0, aoe: st.aoe ?? 0,
          type: st.type ?? sk.type, vi: st.vi ?? sk.vi, col: st.col ?? sk.col, vfxEnd: st.vfxEnd, vulnHit: st.vulnHit, slow: st.slow, stun: st.stun, fx: st.fx, mag: st.mag ?? sk.mag };
        this.fireProjectiles(S, pseudo, ctx.a + (st.off ?? 0), null); break;
      }
      case 'pull': {   // a hook: drag every enemy in reach toward a point
        const [ox, oy] = st.to === 'cursor' ? [ctx.cx, ctx.cy] : [S.x, S.y]; this.emit(S.map, { t: 'pullfx', x: ox, y: oy, r: st.r, th: sk.theme, col: sk.col });
        const foes = this.mobsNear(S, S.x, S.y, st.r).filter((m) => !m.isPlayer);
        for (let i = 1; i <= 6; i++) this.later(i * 45, () => { for (const m of foes) { if (m.hp <= 0 || m.deadUntil) continue; const d = dist(m.x, m.y, ox, oy), gap = Math.max(0, d - (st.stop ?? 1.5)), step = (gap / (7 - i)) * (m.boss ? 0.25 : 1), a = ang(m.x, m.y, ox, oy), nx = m.x + Math.cos(a) * step, ny = m.y + Math.sin(a) * step; if (!blockedAt(getMap(m.map), nx, ny, 0.3)) { m.x = nx; m.y = ny; } } });
        if (st.power) this.later(300, () => { for (const m of this.mobsNear(S, ox, oy, st.stop ? st.stop + 2 : 3.5)) this.hit(S, m, st.power, sk.type ?? 'arcane', sk, 0); }); break;
      }
      case 'mark': {   // curse everything near a point: it takes more damage from everyone for a while
        const [ox, oy] = this.origin(S, st, ctx); this.emit(S.map, { t: 'markfx', x: ox, y: oy, r: st.r, th: sk.theme, col: sk.col });
        for (const m of this.mobsNear(S, ox, oy, st.r)) if (!m.isPlayer) { m.vulnUntil = nw + st.ms; m.vuln = st.v; } break;
      }
      case 'mine': {   // runes / flasks / thorn-nests left on the ground; each goes off when an enemy comes close
        const n = st.n, pa = ang(S.x, S.y, ctx.cx, ctx.cy), map = getMap(S.map);
        for (let i = 0; i < n; i++) {
          let x = S.x, y = S.y;
          if (st.place === 'ring') { const a = (i / n) * TAU + (st.phase ?? 0); x = S.x + Math.cos(a) * st.R; y = S.y + Math.sin(a) * st.R; }
          else if (st.place === 'fan') { const a = ctx.a + (n === 1 ? 0 : (i / (n - 1) - 0.5) * st.spread), d = st.R * (0.55 + 0.45 * ((i % 2) ? 1 : 0.7)); x = S.x + Math.cos(a) * d; y = S.y + Math.sin(a) * d; }
          else { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * st.R; x = ctx.cx + Math.cos(a) * d; y = ctx.cy + Math.sin(a) * d; }
          if (blockedAt(map, x, y, 0.2)) { x = S.x + Math.cos(pa) * 1.5; y = S.y + Math.sin(pa) * 1.5; }
          add({ k: 'mine', x, y, r: st.r, power: st.power, hold: st.hold ?? 0, slow: st.slow ?? 0, vuln: st.vuln ?? 0, delay: i * (st.gap ?? 90), warn: st.arm ?? 600, act: st.dur });
        }
        this.emit(S.map, { t: 'aura', x: S.x, y: S.y, r: 1.8, c: 'ward' }); break;
      }
      case 'seekers': {   // living things that hunt: each picks the nearest enemy, flies at it, hits, and goes on to the next
        for (let i = 0; i < st.n; i++) { const a = (i / st.n) * TAU, h = ctx.a;
          add({ k: 'seeker', x: S.x + Math.cos(a) * 1.1, y: S.y + Math.sin(a) * 1.1, a: a + (st.fan ? h : 0), sp: st.speed, power: st.power, left: st.hits ?? 1, r: st.r ?? 0.6, slow: st.slow ?? 0, stun: st.stun ?? 0, aoe: st.aoe ?? 0, delay: i * (st.gap ?? 70), warn: 150, act: st.life ?? 5000, tid: 0 }); }
        break;
      }
      default: break;
    }
  },

  // advance everything every tick
  tickScripts(nw, dt) {
    if (!this.pz.length && !this.pets.length) return;
    const keep = [];
    for (const z of this.pz) {
      const S = this.sessions.get(z.owner), tail = z.k === 'vortex' || (z.k === 'zone' && z.then); if (!S || S.dead || S.map !== z.map || nw >= z.ae + (tail ? 500 : 0)) { if (S && !S.dead && tail && !z.done && nw >= z.ae) this.vortexEnd(S, z); continue; }
      if (z.follow) { z.x = S.x; z.y = S.y; }
      if (z.k === 'bomb') { const m = this.mobs.find((x) => x.id === z.mobId); if (m && !m.deadUntil) { z.x = m.x; z.y = m.y; } }
      if (nw >= z.we) this.pzActive(S, z, nw, dt);
      keep.push(z);
    }
    this.pz = keep;
    this.tickPets(nw, dt);
  },
  // life steal for ground effects: a small heal per tick in which the effect hit something
  pzSteal(S, z, nw) { if (!z.steal || nw < (z.stealAt ?? 0)) return; z.stealAt = nw + 250; this.healPlayer(S, S.rt.maxHp * z.steal, S); },
  pzActive(S, z, nw, dt) {
    const sk = z.sk;
    switch (z.k) {
      case 'orbit': {
        if (nw < z.next) break; z.next = nw + z.tick; const t = (nw - z.ws) / 1000;
        for (let i = 0; i < z.n; i++) { const a = z.a + (i / z.n) * TAU + z.spin * t, bx = S.x + Math.cos(a) * z.R, by = S.y + Math.sin(a) * z.R;
          for (const m of this.mobsNear(S, bx, by, z.r)) { this.hit(S, m, z.power, sk.type ?? 'arcane', sk, a + Math.PI / 2); this.pzSteal(S, z, nw); }
          if (z.heal) for (const T of [S, ...this.allies(S, z.R + 3)]) if (dist(T.x, T.y, bx, by) <= z.r + 1.2) this.healPlayer(T, T.rt.maxHp * z.heal / z.n * 1.5, S); }
        break;
      }
      case 'beams': case 'line': case 'circle': case 'wall': case 'ring': {
        if (z.k === 'ring' && (z.speed * (nw - z.we)) / 1000 > z.r) { z.ae = nw; break; }
        if (z.k === 'beams' && nw < z.next) break; if (z.k === 'beams') z.next = nw + z.tick;
        for (const m of this.targetsFor(S)) { const id = m.isPlayer ? m.s.id : m.id; if (z.k !== 'beams' && z.hit.has(id)) continue; if (!hazHits(z, m.x, m.y, nw)) continue; z.hit.add(id);
          this.hit(S, m, z.power, sk.type ?? 'arcane', sk, z.a ?? ang(z.x, z.y, m.x, m.y)); this.pzSteal(S, z, nw);
          if (z.stun && !m.isPlayer) m.stunUntil = Math.max(m.stunUntil ?? 0, nw + z.stun * (m.boss ? 0.4 : 1));
          if (z.k === 'wall' && z.push && !m.isPlayer && !m.boss) { const mp = getMap(m.map), nx = m.x + Math.cos(z.a) * z.push, ny = m.y + Math.sin(z.a) * z.push; if (!blockedAt(mp, nx, ny, 0.3)) { m.x = nx; m.y = ny; } } }
        if (z.k === 'circle' && !z.fired) { z.fired = true; this.emit(S.map, { t: 'boom', x: z.x, y: z.y, r: z.r, ty: sk.type, who: S.id }); if (z.healAllies) for (const T of [S, ...this.allies(S, 30)]) if (dist(T.x, T.y, z.x, z.y) <= z.r + 0.5) this.healPlayer(T, T.rt.maxHp * z.healAllies, S); }
        break;
      }
      case 'vortex': {
        if (z.done) break; const k = dt;
        for (const m of this.mobsNear(S, z.x, z.y, z.r)) { if (m.isPlayer) continue; const d = dist(m.x, m.y, z.x, z.y); if (d < 0.6) continue; const a = ang(m.x, m.y, z.x, z.y), step = Math.min(d - 0.4, z.pull * k * (m.boss ? 0.35 : 1)), mp = getMap(m.map), nx = m.x + Math.cos(a) * step, ny = m.y + Math.sin(a) * step; if (!blockedAt(mp, nx, ny, 0.3)) { m.x = nx; m.y = ny; } }
        if (nw >= z.next) { z.next = nw + z.tick; for (const m of this.mobsNear(S, z.x, z.y, z.r)) { this.hit(S, m, z.power, sk.type ?? 'arcane', sk, 0); this.pzSteal(S, z, nw); } }
        if (nw >= z.ae - 30) this.vortexEnd(S, z); break;
      }
      case 'zone': {
        if (nw < z.next) break; z.next = nw + z.tick;
        for (const T of [S, ...this.allies(S, 60)]) if (T.map === S.map && dist(T.x, T.y, z.x, z.y) <= z.r + 0.4) {
          if (z.heal) this.healPlayer(T, T.rt.maxHp * z.heal, S); if (z.effect === 'aegis') { T.aegisUntil = nw + z.tick * 2.2; T.aegisRed = z.red; T.aegisReflect = z.reflect; } }
        if (z.power || z.vuln || z.hold || z.effect === 'slow') for (const m of this.mobsNear(S, z.x, z.y, z.r)) { if (z.power) { this.hit(S, m, z.power, sk.type ?? 'arcane', sk, 0); this.pzSteal(S, z, nw); } if (m.isPlayer) continue;
          if (z.effect === 'slow') m.slowUntil = Math.max(m.slowUntil ?? 0, nw + 900); if (z.vuln) { m.vulnUntil = nw + z.tick * 2.4; m.vuln = z.vuln; } if (z.hold) m.stunUntil = Math.max(m.stunUntil ?? 0, nw + z.hold * (m.boss ? 0.3 : 1)); }
        break;
      }
      case 'mine': {
        if (z.done) break; if (!this.mobsNear(S, z.x, z.y, z.r * 0.75).length) break;
        z.done = true; z.ae = nw; this.emit(S.map, { t: 'boom', x: z.x, y: z.y, r: z.r, ty: sk.type, who: S.id }); this.emit(S.map, { t: 'shake', who: S.id, m: 0.5 });
        for (const m of this.mobsNear(S, z.x, z.y, z.r)) { this.hit(S, m, z.power, sk.type ?? 'arcane', sk, ang(z.x, z.y, m.x, m.y)); this.pzSteal(S, z, nw); if (m.isPlayer) continue; if (z.hold) m.stunUntil = Math.max(m.stunUntil ?? 0, nw + z.hold * (m.boss ? 0.4 : 1)); if (z.slow) m.slowUntil = Math.max(m.slowUntil ?? 0, nw + z.slow); if (z.vuln) { m.vulnUntil = nw + 5000; m.vuln = z.vuln; } }
        break;
      }
      case 'seeker': {
        let t = z.tid ? this.targetsFor(S).find((o) => (o.isPlayer ? o.s.id : o.id) === z.tid && o.hp > 0 && !o.deadUntil) : null;
        if (!t) { z.tid = 0; t = this.targetsFor(S).filter((o) => !z.hit.has(o.isPlayer ? o.s.id : o.id) && dist(z.x, z.y, o.x, o.y) < 16).sort((p, q) => dist(z.x, z.y, p.x, p.y) - dist(z.x, z.y, q.x, q.y))[0]; if (t) z.tid = t.isPlayer ? t.s.id : t.id; }
        if (!t) { const a = ang(z.x, z.y, S.x, S.y), d = dist(z.x, z.y, S.x, S.y); if (d > 2.4) { z.x += Math.cos(a) * z.sp * 0.5 * dt; z.y += Math.sin(a) * z.sp * 0.5 * dt; z.a = a; } break; }   // nothing to hunt: hover near the owner
        const a = ang(z.x, z.y, t.x, t.y), d = dist(z.x, z.y, t.x, t.y), turn = ((a - z.a + Math.PI * 3) % TAU) - Math.PI;   // steer: a curved, hunting flight
        z.a += clamp(turn, -7 * dt, 7 * dt); const sp = z.sp * Math.min(1, 0.5 + (nw - z.we) / 600); const nx = z.x + Math.cos(z.a) * sp * dt, ny = z.y + Math.sin(z.a) * sp * dt; if (!blockedAt(getMap(S.map), nx, ny, 0.1)) { z.x = nx; z.y = ny; }
        if (d <= z.r + (t.radius ?? 0.4)) { z.hit.add(t.isPlayer ? t.s.id : t.id); z.tid = 0; this.hit(S, t, z.power, sk.type ?? 'arcane', sk, z.a); this.pzSteal(S, z, nw); this.emit(S.map, { t: 'spark', x: t.x, y: t.y - 0.3, a: z.a, ty: sk.type, n: 6 });
          if (z.slow && !t.isPlayer) t.slowUntil = nw + z.slow; if (z.stun && !t.isPlayer) t.stunUntil = Math.max(t.stunUntil ?? 0, nw + z.stun * (t.boss ? 0.4 : 1));
          if (z.aoe) { this.emit(S.map, { t: 'boom', x: t.x, y: t.y, r: z.aoe, ty: sk.type, who: S.id }); for (const o of this.mobsNear(S, t.x, t.y, z.aoe)) if (o !== t) this.hit(S, o, z.power * 0.5, sk.type ?? 'arcane', sk, 0); }
          if (--z.left <= 0) z.ae = nw; }
        break;
      }
      case 'bomb': {
        if (z.fired) break; z.fired = true; this.emit(S.map, { t: 'boom', x: z.x, y: z.y, r: z.r, ty: sk.type, who: S.id }); this.emit(S.map, { t: 'shake', who: S.id, m: 0.6 });
        for (const m of this.mobsNear(S, z.x, z.y, z.r)) { this.hit(S, m, z.power, sk.type ?? 'arcane', sk, 0);
          if (z.cascade && Math.random() < z.cascade && !z.nested) this.addPz(S, sk, { k: 'bomb', x: m.x, y: m.y, mobId: m.isPlayer ? null : m.id, r: z.r * 0.8, power: z.power * 0.6, cascade: 0, nested: true, warn: 450, act: 300 }); }
        break;
      }
      default: break;
    }
  },
  vortexEnd(S, z) {
    if (z.done) return; z.done = true; const f = z.then; if (!f) return; this.emit(S.map, { t: 'boom', x: z.x, y: z.y, r: f.r, ty: z.sk.type, who: S.id }); this.emit(S.map, { t: 'shake', who: S.id, m: 1 });
    for (const m of this.mobsNear(S, z.x, z.y, f.r)) { this.hit(S, m, f.power, z.sk.type ?? 'arcane', z.sk, 0); if (f.stun && !m.isPlayer) m.stunUntil = Math.max(m.stunUntil ?? 0, this.now() + f.stun * (m.boss ? 0.4 : 1)); }
  },

  // familiars follow and fight; totems stand and pulse
  tickPets(nw, dt) {
    const keep = [];
    for (const p of this.pets) {
      const S = this.sessions.get(p.owner); if (!S || S.dead || S.map !== p.map || nw >= p.until) continue;
      const foes = this.targetsFor(S).filter((t) => dist(p.x, p.y, t.x, t.y) <= (p.fixed ? p.range : 14)).sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y));
      if (!p.fixed) {   // familiars: stay near the owner, run at the nearest enemy
        const tgt = foes[0], goal = tgt && dist(S.x, S.y, tgt.x, tgt.y) < 12 ? tgt : S, melee = p.melee, stand = goal === S ? 2.2 : melee ? 0.9 : p.range * 0.6, d = dist(p.x, p.y, goal.x, goal.y);
        if (d > stand) { const a = ang(p.x, p.y, goal.x, goal.y), sp = (melee ? 6.2 : 4.5) * dt, nx = p.x + Math.cos(a) * sp, ny = p.y + Math.sin(a) * sp; if (!blockedAt(getMap(p.map), nx, ny, 0.25)) { p.x = nx; p.y = ny; } p.face = a; }
        if (d > 18) { p.x = S.x; p.y = S.y; }
      }
      if (p.pullR) for (const m of this.mobsNear(S, p.x, p.y, p.pullR)) { if (m.isPlayer) continue; const d = dist(m.x, m.y, p.x, p.y); if (d < 0.9) continue; const a = ang(m.x, m.y, p.x, p.y), stp = Math.min(d - 0.7, 3.2 * dt * (m.boss ? 0.3 : 1)), nx = m.x + Math.cos(a) * stp, ny = m.y + Math.sin(a) * stp; if (!blockedAt(getMap(m.map), nx, ny, 0.3)) { m.x = nx; m.y = ny; } }
      if (nw >= p.next && p.power > 0) {
        const t = foes[0]; if (t && (p.fixed || dist(p.x, p.y, t.x, t.y) <= (p.melee ? 1.8 : p.range))) {
          p.next = nw + p.every; p.face = ang(p.x, p.y, t.x, t.y);
          if (p.melee) { this.emit(p.map, { t: 'slash', x: p.x, y: p.y, a: p.face, range: 1.8, arc: 140, ty: p.sk.type, who: `p${p.id}`, step: 0, dir: 1, big: p.aoe ? 1 : 0, mag: 0 }); this.hit(S, t, p.power, p.sk.type ?? 'arcane', p.sk, p.face); if (p.aoe) { this.emit(p.map, { t: 'boom', x: t.x, y: t.y, r: p.aoe, ty: p.sk.type, who: S.id }); for (const o of this.mobsNear(S, t.x, t.y, p.aoe)) if (o !== t) this.hit(S, o, p.power * 0.7, p.sk.type ?? 'arcane', p.sk, p.face); } }
          else if (p.vi) { this.spawnProj({ map: p.map, x: p.x, y: p.y - 0.3, a: p.face, speed: 15, r: 0.3, power: p.power, type: p.sk.type ?? 'arcane', range: Math.max(6, p.range + 2), pierce: 0, aoe: p.aoe ?? 0, sk: { ...p.sk, kind: 'proj', vi: p.vi, quiet: true }, col: p.col, vi: p.vi, owner: { k: 'p', id: S.id } }); }
          else { this.emit(p.map, { t: 'chainfx', x0: p.x, y0: p.y - 0.3, x1: t.x, y1: t.y, th: p.th, col: p.col }); this.hit(S, t, p.power, p.sk.type ?? 'arcane', p.sk, p.face); if (p.aoe) for (const o of this.mobsNear(S, t.x, t.y, p.aoe)) if (o !== t) this.hit(S, o, p.power * 0.6, p.sk.type ?? 'arcane', p.sk, p.face); }
          if (p.steal) this.healPlayer(S, S.rt.maxHp * p.steal, S);
        }
      }
      if (p.aura && nw >= (p.auraAt ?? 0)) {
        p.auraAt = nw + 1000; const a = p.aura;
        for (const T of [S, ...this.allies(S, 60)]) if (T.map === p.map && dist(T.x, T.y, p.x, p.y) <= p.r + 0.4) { if (a.heal) this.healPlayer(T, T.rt.maxHp * a.heal, S); if (a.dmg) { T.buff = { id: p.sk.id, until: nw + 1500, dmg: a.dmg }; } if (a.red) { T.aegisUntil = nw + 1500; T.aegisRed = a.red; T.aegisReflect = 0; } }
        if (a.taunt) for (const m of this.mobs) if (m.map === p.map && !m.deadUntil && m.hp > 0 && dist(m.x, m.y, p.x, p.y) <= p.r) { m.target = S.id; m.tauntUntil = nw + 1500; }
      }
      keep.push(p);
    }
    this.pets = keep;
  },

  pzView(mapId) {
    const out = [];
    for (const z of this.pz) { if (z.map !== mapId) continue; const o = { id: z.id, k: z.k, th: z.theme, col: z.col, x: +z.x.toFixed(2), y: +z.y.toFixed(2), ws: z.ws, we: z.we, ae: z.ae };
      for (const f of ['a', 'r', 'n', 'R', 'len', 'w', 'spin', 'speed', 'span', 'fall', 'effect', 'pull', 'gapAt', 'gapW', 'big', 'suit']) if (z[f] !== undefined) o[f] = typeof z[f] === 'number' ? +z[f].toFixed(3) : z[f];
      if (z.k === 'bomb') o.mob = z.mobId ?? 0; out.push(o); }
    for (const p of this.pets) if (p.map === mapId) out.push({ id: p.id, k: 'pet', kind: p.kind, th: p.th, col: p.col, x: +p.x.toFixed(2), y: +p.y.toFixed(2), a: +p.face.toFixed(2), ae: p.until, r: p.r ?? 0, ws: p.born ?? 0 });
    return out;
  },
};
void orbPos; void clamp; void rad; void FOLLOW;
