import { GameServer } from '../src/server/gameserver.js';
import { CLASSES, SKILLS, ZONES } from '../src/data.js';
import { loadoutOf } from '../src/loadout.js';
const LVL = +(process.argv[2] ?? 25), DUR = 30000;
function run(cid, targets) {
  const clock = { t: 1_000_000 }; const srv = new GameServer({ seed: 5, now: () => clock.t });
  const conn = { msgs: [], send() {}, session: null };
  const base = ['warrior', 'mage', 'archer', 'blacksmith', 'alchemist', 'merchant'].includes(cid) ? cid : 'warrior';
  srv.join(conn, { name: 'T' + cid, create: { classId: base } }); const S = conn.session, P = S.P;
  P.classId = cid; P.level = LVL; P.learned = Object.values(SKILLS).filter((s) => s.cls.includes(cid)).map((s) => s.id); P.loadout = null; srv.recalc(S);
  const lo = loadoutOf(P); S.hp = S.rt.maxHp; S.mp = S.rt.maxMp; S.immuneUntil = 1e12;
  const A = { map: 'quarry', x: 38.5, y: 21.5 }; S.map = A.map; S.x = A.x; S.y = A.y; srv.mobs = srv.mobs.filter((m) => m.map !== A.map);
  const mobs = []; const pts = targets === 1 ? [[1.4, 0]] : [[1.4, 0], [2.4, 1.2], [2.4, -1.2], [3.4, 0], [1.6, 1.8]];
  for (const [dx, dy] of pts) { const m = { id: srv.nextEnt++, map: A.map, x: A.x + dx, y: A.y + dy, hx: A.x + dx, hy: A.y + dy, boss: false, elite: false, deadUntil: 0, temp: true, forceKey: 'rock_hound', forceLevel: LVL }; srv.rollMob(m, { lvl: LVL, enemies: ['rock_hound'] }); m.maxHp = m.hp = 1e9; m.stunUntil = 1e12; m.x = A.x + dx; m.y = A.y + dy; srv.mobs.push(m); mobs.push(m); }
  let nd = 0, sum = 0; const oe = srv.emit.bind(srv); srv.emit = (map, e) => { if (e.t === 'dmg' && (e.k === 'mob' || e.k === 'crit')) { nd++; sum += e.v; } return oe(map, e); };
  const hpStart = mobs.reduce((a, m) => a + m.hp, 0), tgt = mobs[0];
  for (let t = 0; t < DUR; t += 50) {
    clock.t += 50; S.stunUntil = 0; S.dashLock = 0; S.hp = S.rt.maxHp; S.x = A.x; S.y = A.y; if (S.mp < S.rt.maxMp * 0.05) S.mp = S.rt.maxMp * 0.05;
    for (let i = 0; i < 4; i++) { const sk = SKILLS[lo[i]]; if (!sk) continue; if (sk.kind === 'heal' || sk.kind === 'taunt' || sk.kind === 'guard') continue; if ((S.cds[sk.id] ?? 0) <= clock.t && S.mp >= sk.mp) srv.handle(conn, { t: 'skill', i, a: 0, tx: tgt.x, ty: tgt.y }); }
    srv.handle(conn, { t: 'atk', a: 0, tx: tgt.x, ty: tgt.y }); srv.tick();
  }
  const dmg = sum; if (process.env.DBG) console.log(cid, 'events', nd, 'sum', sum, 'hpDelta', hpStart - mobs.reduce((a, m) => a + m.hp, 0));
  return { dps: dmg / (DUR / 1000), hp: S.rt.maxHp, def: S.rt.def, atk: S.rt.atk, kit: lo.map((id) => id ?? '-').join(',') };
}
const ids = Object.values(CLASSES).map((c) => c.id), out = [];
for (const id of ids) { const one = run(id, 1), five = run(id, 5); out.push({ id, kind: CLASSES[id].mythic ? 'mythic' : CLASSES[id].hidden ? 'hidden' : 'base', hp: one.hp, def: one.def, atk: one.atk, dps1: Math.round(one.dps), dps5: Math.round(five.dps), kit: one.kit }); }
console.log(`level ${LVL}, 30 s, optimal skill+basic spam, no gear, dummy target`);
console.log('class'.padEnd(20), 'kind'.padEnd(7), 'HP'.padStart(5), 'DEF'.padStart(4), 'ATK'.padStart(4), 'DPS(1)'.padStart(7), 'DPS(5)'.padStart(7), ' kit');
for (const o of out) console.log(o.id.padEnd(20), o.kind.padEnd(7), String(o.hp).padStart(5), String(o.def).padStart(4), String(o.atk).padStart(4), String(o.dps1).padStart(7), String(o.dps5).padStart(7), ' ', o.kit);
