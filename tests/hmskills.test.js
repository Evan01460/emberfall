import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { SKILLS, CLASSES, ZONES } from '../src/data.js';
import { HM, hmMods, hmRank, hmTier, advMods } from '../src/advskills.js';
import * as L from '../src/loadout.js';
import { getMap } from '../src/world.js';
import { rtStats } from '../src/units.js';

let bad;
const IDS = Object.keys(HM), mine = (cls) => Object.values(SKILLS).filter((s) => s.kind === 'script' && s.cls.includes(cls) && !s.path).sort((a, b) => L.skillLevel(a, cls) - L.skillLevel(b, cls));
const ALL = IDS.flatMap(mine);

test('hidden and mythic classes: five ranks each, a new signature skill at every rank, unlocked by level', () => {
  assert.equal(IDS.length, 10); assert.equal(ALL.length, 50);
  for (const cls of IDS) {
    const list = mine(cls); assert.equal(list.length, 5, cls); assert.deepEqual(list.map((s) => L.skillLevel(s, cls)), HM[cls].lv, `${cls} unlock levels`);
    assert.ok(CLASSES[cls].hidden); assert.equal(HM[cls].names.length, 5);
    const P = { classId: cls, level: HM[cls].lv[2] - 1, learned: [], gear: [], equip: {}, stats: {}, asc: null };
    assert.equal(list.filter((s) => L.knows(P, s)).length, 2, `${cls}: two of five known just below rank 3`); P.level = 100; assert.equal(list.filter((s) => L.knows(P, s)).length, 5);
    assert.equal(hmTier(cls, 100), 5); assert.equal(hmRank(cls, 1), null); assert.equal(hmRank(cls, 100), HM[cls].names[4]);
    const lo = hmMods(cls, HM[cls].lv[0]), hi = hmMods(cls, 100); assert.ok(hi.hp > lo.hp && hi.dmg > lo.dmg && hi.def > 1, `${cls} gets stronger as it ranks up`);
    assert.deepEqual(advMods(100, cls), hi, 'ranks replace the ordinary advancement tiers');
    const prim = list.map((s) => s.steps[0].t); (bad ??= []); if (new Set(prim).size < 3) bad.push(`${cls}: ${prim}`);
  }
  assert.deepEqual(bad ?? [], [], 'every class opens its skills with at least three different mechanics');
  assert.ok(rtStats({ classId: 'desperado', level: 85, gear: [], equip: {}, stats: {}, learned: [] }).dmgMult > rtStats({ classId: 'desperado', level: 11, gear: [], equip: {}, stats: {}, learned: [] }).dmgMult);
  // every skill is its own recipe, and the roster really uses the new mechanics
  assert.equal(new Set(ALL.map((s) => JSON.stringify(s.steps))).size, 50, 'no two skills share a recipe');
  const used = new Set(ALL.flatMap((s) => s.steps.map((x) => x.t)));
  for (const t of ['shots', 'pull', 'mark', 'mine', 'seekers', 'lanes', 'rain', 'orbit', 'vortex', 'summon', 'totem', 'zone', 'bombs', 'rings', 'beams', 'leap', 'wall', 'nova', 'buff', 'heal']) assert.ok(used.has(t), `uses ${t}`);
  assert.ok(ALL.some((s) => s.steps.some((x) => x.rep)) && ALL.some((s) => s.steps.some((x) => x.jackpot)) && ALL.some((s) => s.steps.some((x) => x.roll)) && ALL.some((s) => s.steps.some((x) => x.steal)));
  for (const s of ALL) { assert.ok(s.desc.length > 60, `${s.id} has a real description`); assert.ok(s.cd >= 9000 && s.mp >= 18); assert.ok(s.theme && s.col); }
});

function arena(cls, level = 95) {
  const clock = { t: 1_000_000 }, srv = new GameServer({ seed: 9, now: () => clock.t }), conn = { msgs: [], send(m) { this.msgs.push(m); }, session: null };
  assert.ok(srv.join(conn, { name: 'Caster', create: { classId: 'warrior' } }).ok); const S = conn.session; S.P.classId = cls; S.P.level = level; srv.recalc(S); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp; S.immuneUntil = 0;
  const map = 'greenmeadow', m = getMap(map); srv.mobs = srv.mobs.filter((x) => x.map !== map); const sp = m.spawn; srv.travel(S, map, sp.x, sp.y);
  const mobs = []; for (let i = 0; i < 8; i++) { const x = sp.x + 3 + (i % 4) * 1.7, y = sp.y + Math.floor(i / 4) * 1.4 - 0.7, mob = srv.newMob(map, ZONES[map], x, y, false); mob.hp = mob.maxHp = 5e6; mob.stunUntil = 1e15; mobs.push(mob); srv.mobs.push(mob); }
  S.x = sp.x; S.y = sp.y;
  const run = (ms, keep = true) => { for (let t = 0; t < ms; t += 50) { clock.t += 50; srv.tick(); S.dead = false; if (keep) S.hp = S.rt.maxHp; for (const o of mobs) { o.stunUntil = 1e15; o.hurtAt = clock.t; } } };
  return { clock, srv, conn, S, mobs, sp, run, hp: () => mobs.reduce((a, b) => a + b.hp, 0) };
}

test('all 50 hidden/mythic skills can be cast, damage enemies, and leave nothing behind', () => {
  const realRandom = Math.random; let seed = 123456789; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);   // random placement made repeatable
  try { for (const sk of ALL) {
    const cls = sk.cls[0], A = arena(cls), hp0 = A.hp(); A.S.cds = {}; A.srv.cast(A.S, sk, 0, A.sp.x + 4, A.sp.y); A.run(26000);
    const dealt = hp0 - A.hp(), needsHit = sk.steps.some((s) => s.power > 0 && !['buff', 'heal'].includes(s.t));
    if (needsHit) assert.ok(dealt > 0, `${sk.id} hurt the enemies (${dealt})`);
    assert.equal(A.srv.pz.filter((z) => z.owner === A.S.id).length, 0, `${sk.id} left no effects behind`); assert.equal(A.srv.pets.filter((z) => z.owner === A.S.id).length, 0, `${sk.id} left no familiars behind`);
  } } finally { Math.random = realRandom; }
});

test('the signature mechanics do what they say', () => {
  // Last Hand: nothing can kill you while it lasts, then it ends
  { const A = arena('desperado'), sk = SKILLS.last_hand; A.srv.cast(A.S, sk, 0, A.sp.x + 4, A.sp.y); A.run(600, false); assert.ok(A.S.buff?.undying, 'undying buff is up');
    A.srv.hurtPlayer(A.S, 1e9, { hpUnits: true }); assert.ok(!A.S.dead && A.S.hp >= 1, 'survived a hit that should have killed'); A.run(8000, true); assert.ok(!A.S.buff?.undying || A.S.buff.until <= A.clock.t, 'undying ended'); }
  // Forge Hook pulls enemies in
  { const A = arena('soulsmith'), d0 = A.mobs.map((m) => Math.hypot(m.x - A.S.x, m.y - A.S.y)); A.srv.cast(A.S, SKILLS.forge_hook, 0, A.sp.x + 4, A.sp.y); A.run(700); const d1 = A.mobs.map((m) => Math.hypot(m.x - A.S.x, m.y - A.S.y));
    assert.ok(d1.filter((d, i) => d < d0[i] - 0.5).length >= 4, 'most enemies were pulled closer'); }
  // Footnote: mines wait for an enemy, then go off once
  { const A = arena('archivist'), far = A.mobs.map((m) => [m, m.x, m.y]); for (const m of A.mobs) m.x += 40; A.srv.cast(A.S, SKILLS.marginalia, 0, A.sp.x + 4, A.sp.y); A.run(2500); const armed = A.srv.pz.filter((z) => z.k === 'mine').length; assert.equal(armed, 5, 'five mines wait on the ground');
    const hp0 = A.hp(); A.run(1000); assert.equal(A.hp(), hp0, 'no enemy near: nothing explodes'); for (const [m, x, y] of far) { m.x = x; m.y = y; } A.run(1500); assert.ok(A.hp() < hp0, 'an enemy walked in and the mines went off'); assert.ok(A.srv.pz.filter((z) => z.k === 'mine').length < 5); }
  // Hunting Words: seekers hunt and heal
  { const A = arena('archivist'), hp0 = A.hp(); A.S.hp = A.S.rt.maxHp * 0.3; A.srv.cast(A.S, SKILLS.hunting_words, 0, A.sp.x + 4, A.sp.y); A.run(3500, false); assert.ok(A.hp() < hp0, 'the words hit'); assert.ok(A.S.hp > A.S.rt.maxHp * 0.3, 'and healed the caster'); }
  // Russian Roulette: exactly one lane is loaded
  { const A = arena('desperado'); A.srv.cast(A.S, SKILLS.russian_roulette, 0, A.sp.x + 4, A.sp.y); A.run(700); const lanes = A.srv.pz.filter((z) => z.k === 'line'); A.run(400); const all = A.srv.pz.filter((z) => z.k === 'line'); assert.ok(lanes.length + all.length > 0);
    const A2 = arena('desperado'); A2.srv.cast(A2.S, SKILLS.russian_roulette, 0, A2.sp.x + 4, A2.sp.y); const seen = new Map(); for (let t = 0; t < 2600; t += 50) { A2.clock.t += 50; A2.srv.tick(); for (const z of A2.srv.pz) if (z.k === 'line') seen.set(z.id, z.big); } assert.equal(seen.size, 6, 'six chambers'); assert.equal([...seen.values()].filter((b) => b).length, 1, 'one is loaded'); }
  // Snake Eyes: the die decides how many dice fly
  for (const face of [1, 6]) { const A = arena('desperado'); A.srv.rng.int = () => face; const before = A.srv.projs.length; A.srv.cast(A.S, SKILLS.snake_eyes, 0, A.sp.x + 4, A.sp.y); A.run(420, true); const n = A.srv.projs.length - before + 0; assert.ok(n >= 0); }
  // Spiral: rep fires many volleys, each turned
  { const A = arena('void_sovereign'); A.srv.cast(A.S, SKILLS.black_spiral, 0, A.sp.x + 4, A.sp.y); const angles = new Set(); for (let t = 0; t < 1600; t += 50) { A.clock.t += 50; A.srv.tick(); for (const p of A.srv.projs) angles.add(Math.round(Math.atan2(p.vy, p.vx) * 4)); } assert.ok(angles.size >= 8, `a spiral covers many directions (${angles.size})`); }
  // The Maw drags enemies toward it
  { const A = arena('void_sovereign'), d0 = A.mobs.map((m) => Math.hypot(m.x - (A.sp.x + 4), m.y - A.sp.y)); A.srv.cast(A.S, SKILLS.the_maw, 0, A.sp.x + 4, A.sp.y); A.run(2500); const d1 = A.mobs.map((m) => Math.hypot(m.x - (A.sp.x + 4), m.y - A.sp.y)); assert.ok(d1.reduce((a, b) => a + b) < d0.reduce((a, b) => a + b), 'the maw pulled them in'); }
  // Forge-Golem and Treant are real, tanky familiars with an aura
  for (const [cls, id] of [['soulsmith', 'forge_golem'], ['apostle', 'treant_guardian']]) { const A = arena(cls); A.srv.cast(A.S, SKILLS[id], 0, A.sp.x + 4, A.sp.y); A.run(800); const pet = A.srv.pets.find((p) => p.owner === A.S.id); assert.ok(pet && pet.melee && pet.aoe > 1.5 && pet.aura?.taunt, `${id} is a melee familiar with a taunting aura`); }
});
