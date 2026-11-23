import { GameServer } from '../src/server/gameserver.js';
import { SKILLS } from '../src/data.js';
const LVL = 25;
function cast(cid, sid, line) {
  const clock = { t: 1_000_000 }; const srv = new GameServer({ seed: 9, now: () => clock.t }); const conn = { send() {}, session: null };
  srv.join(conn, { name: 'Tester', create: { classId: 'warrior' } }); const S = conn.session, P = S.P; P.classId = cid; P.level = LVL; P.learned = [sid]; P.loadout = [sid, null, null, null]; srv.recalc(S);
  S.mp = S.rt.maxMp; S.immuneUntil = 1e12; S.map = 'quarry'; S.x = 38.5; S.y = 21.5; srv.mobs = srv.mobs.filter((m) => m.map !== 'quarry');
  const mobs = []; const pts = line ? [[2, 0], [3.5, 0], [5, 0], [6.5, 0], [8, 0], [9.5, 0]] : [[2, 0]];
  for (const [dx, dy] of pts) { const m = { id: srv.nextEnt++, map: 'quarry', x: 38.5 + dx, y: 21.5 + dy, hx: 38.5 + dx, hy: 21.5 + dy, boss: false, elite: false, deadUntil: 0, temp: true, forceKey: 'rock_hound', forceLevel: LVL }; srv.rollMob(m, { lvl: LVL, enemies: ['rock_hound'] }); m.maxHp = m.hp = 1e9; m.stunUntil = 1e12; m.x = 38.5 + dx; m.y = 21.5 + dy; srv.mobs.push(m); mobs.push(m); }
  let sum = 0; const oe = srv.emit.bind(srv); srv.emit = (map, e) => { if (e.t === 'dmg' && (e.k === 'mob' || e.k === 'crit')) sum += e.v; return oe(map, e); };
  srv.handle(conn, { t: 'skill', i: 0, a: 0, tx: 38.5 + 2, ty: 21.5 }); for (let t = 0; t < 3000; t += 50) { clock.t += 50; S.hp = S.rt.maxHp; S.x = 38.5; srv.tick(); }
  return sum;
}
const list = [['desperado', 'all_in'], ['archivist', 'epilogue'], ['soulsmith', 'coldstar_nova'], ['broker', 'liquidation'], ['transmuter', 'grand_transmutation'], ['apostle', 'worldtree_wrath'], ['void_sovereign', 'oblivion'], ['titan_forgemaster', 'forge_nova'], ['philosopher', 'aurum_flask'], ['gilded', 'gilded_cage']];
console.log('ultimate'.padEnd(22), 'cd'.padStart(6), 'pwr'.padStart(5), 'dmg x1'.padStart(7), 'dmg line of 6'.padStart(14), ' per-second-of-cd (1 / 6)');
for (const [c, s] of list) { const k = SKILLS[s], a = cast(c, s, false), b = cast(c, s, true); console.log(s.padEnd(22), String(k.cd / 1000).padStart(6), String(k.power).padStart(5), String(a).padStart(7), String(b).padStart(14), '  ', (a / (k.cd / 1000)).toFixed(0), '/', (b / (k.cd / 1000)).toFixed(0)); }
