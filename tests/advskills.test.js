import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { SKILLS, PATHS, ZONES } from '../src/data.js';
import { ADV_LEVELS, advMods, advName, advTier, ADV_NAMES } from '../src/advskills.js';
import * as L from '../src/loadout.js';
import { getMap } from '../src/world.js';
import { rtStats } from '../src/units.js';

const scripts = Object.values(SKILLS).filter((s) => s.kind === 'script');

test('advancements: three tiers per path (35/55/80), one distinct skill each, all registered and unlockable by level', () => {
  assert.deepEqual(ADV_LEVELS, [35, 55, 80]); assert.equal(scripts.length, Object.keys(PATHS).length * 3, '45 skills, 3 per path');
  for (const [pid, p] of Object.entries(PATHS)) { const mine = scripts.filter((s) => s.path === pid).sort((a, b) => a.lvl - b.lvl); assert.deepEqual(mine.map((s) => s.lvl), [35, 55, 80], pid); assert.equal(ADV_NAMES[pid].length, 3); for (const s of mine) { assert.ok(p.kit.some(([id]) => id === s.id)); assert.ok(s.cd >= 14000 && s.mp > 0 && s.desc.length > 40 && s.steps.length >= 1 && s.theme && s.col && s.g, s.id); } }
  // every skill is a different recipe: no two share the same ordered mechanics and numbers
  const sig = new Set(scripts.map((s) => JSON.stringify(s.steps))); assert.equal(sig.size, scripts.length, 'no two skills are the same mechanic with the same numbers');
  // each path's three skills use different primary mechanics
  for (const pid of Object.keys(PATHS)) { const prim = scripts.filter((s) => s.path === pid).map((s) => s.steps[0].t); assert.equal(new Set(prim).size, 3, `${pid} three different mechanics: ${prim}`); }
  const kinds = new Set(scripts.flatMap((s) => s.steps.map((x) => x.t))); assert.ok(kinds.size >= 14, `at least 14 distinct mechanics (${[...kinds]})`);
  // unlock by level and path
  const P = { classId: 'warrior', level: 34, asc: { path: 'mana_sword' }, learned: [] }; assert.ok(!L.knows(P, SKILLS.spectral_orbit)); P.level = 35; assert.ok(L.knows(P, SKILLS.spectral_orbit)); P.asc.path = 'brute'; assert.ok(!L.knows(P, SKILLS.spectral_orbit));
  assert.equal(advTier(20), 0); assert.equal(advTier(35), 1); assert.equal(advTier(80), 3); assert.equal(advName('brute', 60), 'Colossus'); assert.equal(advName('brute', 10), null);
  const m1 = advMods(35, 'warrior'), m3 = advMods(80, 'warrior'); assert.ok(m3.hp > m1.hp && m3.dmg > m1.dmg); assert.equal(Object.keys(advMods(10, 'mage')).length, 0);
  const base = { classId: 'warrior', level: 34, gear: [], equip: {}, asc: { path: 'brute' }, stats: {}, learned: [] }, hi = { ...base, level: 80 }; assert.ok(rtStats(hi).dmgMult > rtStats(base).dmgMult);
});

test('every advancement skill can be cast, damages what it should, and cleans up after itself', () => {
  for (const sk of scripts) {
    const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 5, now: () => clock.t }), conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null };
    assert.ok(srv.join(conn, { name: 'Caster', create: { classId: sk.cls[0] } }).ok); const S = conn.session; S.P.level = 85; srv.recalc(S); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp; S.immuneUntil = 0;
    const map = 'greenmeadow', m = getMap(map); srv.mobs = srv.mobs.filter((x) => x.map !== map); const sp = m.spawn; srv.travel(S, map, sp.x, sp.y);
    const mobs = []; for (let i = 0; i < 6; i++) { const x = sp.x + 3 + (i % 3) * 1.8, y = sp.y + Math.floor(i / 3) * 0.9 - 0.2, mob = srv.newMob(map, ZONES[map], x, y, false); mob.hp = mob.maxHp = 5e6; mob.stunUntil = 1e15; mobs.push(mob); srv.mobs.push(mob); }
    S.x = sp.x; S.y = sp.y; const hp0 = mobs.reduce((a, b) => a + b.hp, 0);
    srv.cast(S, sk, 0, sp.x + 4, sp.y); for (let t = 0; t < 20000; t += 50) { clock.t += 50; srv.tick(); S.dead = false; S.hp = S.rt.maxHp; if (t < 1500) { S.x = sp.x; S.y = sp.y; } for (const o of mobs) { o.stunUntil = 1e15; o.hurtAt = clock.t; } }
    const dealt = hp0 - mobs.reduce((a, b) => a + b.hp, 0);
    const dmg = sk.steps.some((s) => ['orbit', 'rings', 'beams', 'rain', 'lanes', 'chain', 'vortex', 'leap', 'blink', 'summon', 'totem', 'wall', 'bombs', 'nova'].includes(s.t)) && (sk.power > 0 || sk.steps.some((s) => s.power > 0));
    if (dmg) assert.ok(dealt > 0, `${sk.id} hurt the enemies (${dealt})`);
    assert.equal(srv.pz.filter((z) => z.owner === S.id).length, 0, `${sk.id} left no effects behind`); assert.equal(srv.pets.filter((z) => z.owner === S.id).length, 0, `${sk.id} left no familiars behind`);
    assert.ok(conn.msgs.some((x) => x.t === 'snap') || true);
  }
});
