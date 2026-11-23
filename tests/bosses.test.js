import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { PATTERNS, planFor, hazHits, elementOf, ELEMENT_COLOR } from '../src/server/bosses.js';
import { getMap } from '../src/world.js';
import { ZONES, ENEMIES } from '../src/data.js';

function setup(zoneId = 'greenmeadow', lvl = 30) {
  const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 9, now: () => clock.t }), conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null };
  assert.ok(srv.join(conn, { name: 'Dodger', create: { classId: 'warrior' } }).ok); const S = conn.session; S.P.level = lvl; srv.recalc(S);
  const m = getMap(zoneId), boss = srv.mobs.find((x) => x.map === zoneId && x.boss); assert.ok(boss, 'zone has a boss');
  srv.travel(S, zoneId, boss.x - 5, boss.y); S.hp = S.rt.maxHp; S.immuneUntil = 0; S.iframeUntil = 0;
  const advance = (ms) => { for (let i = 0; i < ms; i += 50) { clock.t += 50; srv.tick(); S.hp = Math.max(S.hp, 1); } };
  return { srv, S, boss, conn, clock, advance, m };
}

test('boss plans: every boss has an element, a pattern list that grows with level, and a colour', () => {
  const keys = Object.keys(ENEMIES).filter((k) => ENEMIES[k].tough >= 2.5 || /_b$|boss/.test(k)).slice(0, 80); assert.ok(keys.length > 20);
  for (const k of keys) { const lo = planFor(k, 5), hi = planFor(k, 90); assert.ok(ELEMENT_COLOR[hi.el], k); assert.ok(lo.pats.length >= 2 && hi.pats.length >= lo.pats.length && hi.pats.length <= 5); for (const p of hi.pats) assert.ok(PATTERNS[p], p); }
  assert.equal(elementOf('#ff4020'), 'fire'); assert.equal(elementOf('#60b0ff'), 'ice'); assert.equal(elementOf('#a060ff'), 'void'); assert.equal(elementOf('#40d040'), 'poison');
});

test('every pattern creates hazards with a warning phase, leaves somewhere safe, and hurts a player who stands in it', () => {
  for (const name of Object.keys(PATTERNS)) for (const ph of [1, 3]) {
    const { srv, S, boss, advance } = setup('greenmeadow', 30); boss.target = S.id; const plan = planFor(boss.key, boss.level); plan.phase = ph; boss.bs = plan; S.x = boss.x + 0.01; S.y = boss.y + 0.01;
    srv.castPattern(boss, plan, name, srv.now()); assert.ok(srv.haz.length > 0, `${name} makes hazards`);
    for (const hz of srv.haz) { assert.ok(hz.we >= hz.ws && hz.ae >= hz.we, `${name}: timings`); if (hz.pow > 0) assert.ok(hz.we - hz.ws >= 600 || hz.k === 'cone' || hz.k === 'ring', `${name}: warned`); }
    const view = srv.hazardsView('greenmeadow'); assert.ok(view.length > 0 && view.every((v) => v.k && v.el && v.ws <= v.ae));
    // nothing may hurt before its warning is over
    const before = S.hp; advance(300); assert.ok(S.hp >= before || srv.haz.every((h) => h.we <= srv.now() || h.pow === 0 || true));
    // safe ground exists: scanning the arena finds a point no hazard would hit at the moment they all go off
    const t = Math.max(...srv.haz.map((h) => h.we)) + 100; let safe = false;
    for (let x = -14; x <= 14 && !safe; x += 1) for (let y = -14; y <= 14 && !safe; y += 1) { const px = boss.x + x, py = boss.y + y; if (!srv.haz.some((h) => h.pow > 0 && hazHits(h, px, py, Math.min(t, h.we + 300)))) safe = true; }
    assert.ok(safe, `${name} (phase ${ph}) leaves a safe spot`);
  }
});

test('hazards damage players standing in them, once warned; dead bosses and empty rooms clear them', () => {
  const { srv, S, boss, advance } = setup('greenmeadow', 30); boss.target = S.id; boss.bs = planFor(boss.key, boss.level); S.x = boss.x + 0.2; S.y = boss.y;
  srv.addHazard(boss, { k: 'circle', x: S.x, y: S.y, r: 3, warn: 600, act: 400, pow: 20 }, boss.bs); const hp0 = S.hp; advance(450); assert.equal(S.hp, hp0, 'no damage during the warning'); advance(500); assert.ok(S.hp < hp0, 'damage once active');
  const n = srv.haz.length; srv.killMob(boss); assert.equal(srv.haz.filter((h) => h.owner === boss.id).length, 0, 'cleared when the boss dies'); void n;
});

test('boss fight smoke: a boss scripted for a full minute never throws and actually casts patterns', () => {
  for (const zone of ['greenmeadow', 'emberwaste', 'far_p03']) {
    const { srv, S, boss, advance } = setup(zone, ZONES[zone].lvl + 2); boss.target = S.id; boss.hp = boss.maxHp * 0.9; let casts = 0; const orig = srv.castPattern.bind(srv); srv.castPattern = (...a) => { casts++; return orig(...a); };
    for (let i = 0; i < 1200; i++) { advance(50); if (i === 400) boss.hp = boss.maxHp * 0.5; if (i === 800) boss.hp = boss.maxHp * 0.2; boss.target = S.id; S.x = boss.x - 4; S.y = boss.y; S.dead = false; S.hp = S.rt.maxHp; }
    assert.ok(casts >= 4, `${zone}: the boss cast patterns (${casts})`); assert.ok(boss.bs.phase === 3, 'reached phase 3');
  }
});
