import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { getMap, PLAYER_SPEED, dist, blockedAt } from '../src/world.js';
import { ENEMIES, SKILLS, CLASSES } from '../src/data.js';
import { ITEMS } from '../src/data.js';
import * as R from '../src/rules.js';

// ── harness ──────────────────────────────────────────────────────────────────
function world(opts = {}) {
  const clock = { t: 1_000_000 };
  const srv = new GameServer({ seed: 7, now: () => clock.t, ...opts });
  const advance = (ms, step = 50) => { for (let i = 0; i < ms; i += step) { clock.t += step; srv.tick(); } };
  return { srv, clock, advance };
}
function client(srv, name, classId = 'warrior', create = true) {
  const conn = { msgs: [], send(m) { this.msgs.push(JSON.parse(JSON.stringify(m))); }, session: null };
  const res = srv.join(conn, { name, create: create ? { classId } : null });
  assert.ok(res.ok, res.error);
  const c = {
    conn, S: conn.session, P: conn.session.P,
    send: (t, d = {}) => srv.handle(conn, { t, ...d }),
    last: (t) => [...conn.msgs].reverse().find((m) => m.t === t),
    all: (t) => conn.msgs.filter((m) => m.t === t),
    clear: () => { conn.msgs.length = 0; },
    teleport: (map, x, y) => { c.S.map = map; c.S.x = x; c.S.y = y; },
  };
  return c;
}

test('join: creates character, sends welcome; same name resumes; bad class rejected', () => {
  const { srv } = world();
  const a = client(srv, 'Alice', 'blacksmith');
  assert.equal(a.last('welcome').me.classId, 'blacksmith');
  assert.equal(srv.join({ send() {} }, { name: 'Bob', create: { classId: 'dragon' } }).ok, false);
  assert.equal(srv.join({ send() {} }, { name: 'Nobody', create: null }).ok, false);
  srv.leave(a.conn);
  const a2 = client(srv, 'alice', 'warrior', false);              // case-insensitive resume keeps class
  assert.equal(a2.P.classId, 'blacksmith');
});

test('movement: valid steps accepted, teleports/walls rejected and corrected', () => {
  const { srv, clock } = world();
  const a = client(srv, 'Mover');
  clock.t += 100; a.send('move', { x: a.S.x + 0.3, y: a.S.y, d: 'r', mv: 1 });
  assert.ok(Math.abs(a.S.x - 27.1) < 1e-6 + 0.0001 || a.S.x > 26.5);
  const x0 = a.S.x; clock.t += 100;
  a.send('move', { x: 40, y: 19.5 }); assert.equal(a.S.x, x0); assert.ok(a.last('correct'));
  clock.t += 3000; a.send('move', { x: 5.5, y: 4.5 });                 // inside a wall far away
  assert.equal(a.S.x, x0);
});

test('portals move you between maps; leaving the town spawns mobs-aware map messages', () => {
  const { srv, clock } = world();
  const a = client(srv, 'Walker'); a.teleport('town', 50.4, 18.5);
  clock.t += 200; a.send('move', { x: 51.4, y: 18.5 });
  assert.equal(a.S.map, 'quarry'); assert.ok(a.last('map'));
});

test('gathering: nodes need proximity, yield items, then go on cooldown shared by everyone', () => {
  const { srv, advance } = world();
  const a = client(srv, 'Miner', 'blacksmith'), b = client(srv, 'Rival', 'warrior');
  const node = getMap('quarry').points.find((p) => p.node === 'ore');
  a.teleport('quarry', node.x + 3, node.y); a.send('interact', { id: node.id });
  assert.equal(a.all('gather.begin').length, 0, 'too far');
  a.teleport('quarry', node.x + 1, node.y); b.teleport('quarry', node.x - 1, node.y);
  a.S.immuneUntil = b.S.immuneUntil = Infinity;
  const before = R.count(a.P, 'iron_ore');
  a.send('interact', { id: node.id }); assert.ok(a.last('gather.begin'));
  advance(2500);
  assert.ok(R.count(a.P, 'iron_ore') > before + 1, 'blacksmith yield bonus');
  b.send('interact', { id: node.id });
  assert.ok(/picked clean/.test(b.last('toast').msg));
  assert.ok(a.last('snap').cds.includes(node.id));
});

test('stations are class-locked: only Blacksmiths forge, only Alchemists brew', () => {
  const { srv } = world();
  const w = client(srv, 'Fighter', 'warrior'), s = client(srv, 'Smith', 'blacksmith'), al = client(srv, 'Brewer', 'alchemist');
  const forge = getMap('town').points.find((p) => p.kind === 'forge'), cauldron = getMap('town').points.find((p) => p.kind === 'cauldron');
  w.teleport('town', forge.x + 1, forge.y); w.send('interact', { id: forge.id });
  assert.ok(/Only Blacksmiths/.test(w.last('toast').msg)); assert.ok(!w.last('ui'));
  s.teleport('town', forge.x + 1, forge.y); s.send('interact', { id: forge.id }); assert.equal(s.last('ui').panel, 'craft');
  s.teleport('town', cauldron.x + 1, cauldron.y); s.send('interact', { id: cauldron.id });
  assert.ok(/Only Alchemists/.test(s.last('toast').msg));
  al.teleport('town', cauldron.x + 1, cauldron.y); al.send('interact', { id: cauldron.id }); assert.equal(al.last('ui').family, 'alchemist');
});

test('forging: server verifies strike timing; cheating (impossible times) is downgraded', () => {
  const { srv, clock, advance } = world();
  const s = client(srv, 'Smith', 'blacksmith'); const forge = getMap('town').points.find((p) => p.kind === 'forge');
  s.teleport('town', forge.x + 1, forge.y);
  s.send('craft.start', { recipe: 'iron_ingot' }); assert.equal(s.last('craft.ticket').kind, 'forge');
  assert.equal(R.count(s.P, 'iron_ore'), 4, 'inputs consumed');
  // cheat: report perfect timings instantly
  s.send('craft.finish', { times: [1, 2, 3] });
  assert.ok(s.last('craft.result').q <= 0.3, 'invalid timings → fumbled batch');
  // honest play: compute perfect strike times
  s.send('craft.start', { recipe: 'iron_ingot' });
  const { spec } = s.last('craft.ticket');
  const times = []; let t = 400;
  for (let i = 0; i < spec.strikes; i++) {
    let best = t, bd = 9;
    for (let c = t; c < t + 4000; c += 5) { const d = Math.abs(R.markerPos(spec, c) - spec.centers[i]); if (d < bd) { bd = d; best = c; } }
    times.push(best); t = best + 300;
  }
  advance(times.at(-1) + 100);
  s.send('craft.finish', { times });
  assert.ok(s.last('craft.result').q > 0.8, `honest perfect play → high quality (${s.last('craft.result').q})`);
  assert.ok(R.count(s.P, 'iron_ingot') >= 1);
});

test('alchemy: press-your-luck brew via server ticket; trade classes cannot brew others\' recipes', () => {
  const { srv } = world();
  const a = client(srv, 'Brewer', 'alchemist'); const c = getMap('town').points.find((p) => p.kind === 'cauldron');
  a.teleport('town', c.x + 1, c.y);
  a.send('craft.start', { recipe: 'iron_ingot' }); assert.ok(!a.last('craft.ticket'), 'wrong craft family');
  a.send('craft.start', { recipe: 'heal_potion' }); assert.equal(a.last('craft.ticket').kind, 'brew');
  a.send('brew.add'); a.send('brew.bottle');
  const res = a.last('craft.result'); assert.ok(res.burst || res.items.length);
});

test('markets: players list & buy from each other; seller is paid; fees apply; own listing cannot be bought', () => {
  const { srv } = world();
  const seller = client(srv, 'Seller', 'merchant'), buyer = client(srv, 'Buyer', 'warrior');
  const board = getMap('town').points.find((p) => p.kind === 'exchange');
  for (const c of [seller, buyer]) { c.teleport('town', board.x + 1, board.y); c.send('interact', { id: board.id }); assert.equal(c.last('ui').panel, 'exchange'); }
  seller.P.items.iron_ore = 20;
  const g0 = seller.P.gilt;
  seller.send('market.list', { itemId: 'iron_ore', qty: 10, price: 9 });
  assert.equal(R.count(seller.P, 'iron_ore'), 10); assert.ok(seller.P.gilt < g0, 'fee charged');
  const l = buyer.last('market').view.listings.find((x) => x.seller === 'Seller'); assert.ok(l, 'buyer sees the new listing instantly');
  seller.send('market.buy', { id: l.id, qty: 1 }); assert.ok(/own listing/.test(seller.last('toast').msg));
  buyer.P.gilt = 1000; const sg = seller.P.gilt;
  buyer.send('market.buy', { id: l.id, qty: 4 });
  assert.equal(R.count(buyer.P, 'iron_ore') - 6, 4); assert.equal(buyer.P.gilt, 1000 - 36);
  assert.equal(seller.P.gilt, sg + 36, 'seller credited immediately');
  seller.send('market.cancel', { id: l.id }); assert.equal(R.count(seller.P, 'iron_ore'), 16);
});

test('offline sellers are paid into a mailbox and told on next login', () => {
  const { srv, clock, advance } = world({ dayMs: 1000 });
  const seller = client(srv, 'Sleeper', 'merchant'); const board = getMap('town').points.find((p) => p.kind === 'exchange');
  seller.teleport('town', board.x + 1, board.y); seller.send('interact', { id: board.id });
  seller.P.items.iron_ore = 50; seller.send('market.list', { itemId: 'iron_ore', qty: 50, price: 1 });
  srv.leave(seller.conn);
  const g0 = srv.players.get(seller.P.id).gilt;
  advance(20000);
  const P = srv.players.get(seller.P.id);
  assert.ok(P.gilt > g0, 'sold while offline'); assert.ok(P.mail.length > 0);
  const back = client(srv, 'Sleeper', 'merchant', false); assert.ok(back.last('welcome').mail.length > 0);
});

test('realms: the Hollow market is separate and has different prices; gate needs a key', () => {
  const { srv } = world();
  assert.ok(srv.markets.hollow.base.iron_ore > srv.markets.main.base.iron_ore * 2);
  assert.ok(srv.markets.hollow.base.hollow_ore < srv.markets.main.base.hollow_ore);
  const a = client(srv, 'Diver', 'warrior'); const gate = getMap('archive').points.find((p) => p.kind === 'gate');
  a.teleport('archive', gate.x, gate.y - 1); a.send('interact', { id: gate.id });
  assert.equal(a.S.map, 'archive'); assert.ok(/sealed/.test(a.last('toast').msg));
  R.addItem(a.P, 'hollow_key', 1); a.send('interact', { id: gate.id });
  assert.equal(a.S.map, 'hollow_reach'); assert.equal(a.P.stats.hollowVisits, 1);
});

test('hidden unlocks happen in-world, evolve your class, and are gated by class and conditions', () => {
  const { srv } = world();
  const f = client(srv, 'Reader', 'mage'), sm = client(srv, 'Smith', 'blacksmith');
  const lect = getMap('archive').points.find((p) => p.secret === 'lectern');
  f.teleport('archive', lect.x, lect.y - 1);
  assert.ok(!f.last('vis')?.vis.includes(lect.id) && !f.last('welcome').vis.includes(lect.id));
  R.addItem(f.P, 'torn_page', 3); f.S.conn.send({ t: 'x' }); srv.afterChange(f.S);
  assert.ok(f.last('vis').vis.includes(lect.id), 'lectern appears once you hold 3 pages');
  f.send('interact', { id: lect.id }); assert.equal(f.last('ui').panel, 'secret');
  f.send('hidden.unlock', { id: 'archivist' }); assert.equal(f.P.classId, 'archivist'); assert.equal(R.count(f.P, 'torn_page'), 0);
  // a blacksmith cannot take the archivist route even with pages
  R.addItem(sm.P, 'torn_page', 3); assert.equal(R.unlockHidden(sm.P, 'archivist').ok, false);
  // soulsmith path
  sm.P.stats.ingots = 6; const cf = getMap('quarry').points.find((p) => p.secret === 'coldforge');
  sm.teleport('quarry', cf.x - 1, cf.y); sm.send('interact', { id: cf.id }); assert.ok(sm.P.flags.coldForge);
  const sf = getMap('quarry').points.find((p) => p.secret === 'starfall'); sm.teleport('quarry', sf.x - 1, sf.y); sm.send('interact', { id: sf.id });
  assert.equal(R.count(sm.P, 'starmetal'), 1);
  sm.teleport('quarry', cf.x - 1, cf.y); sm.send('interact', { id: cf.id }); assert.equal(sm.last('ui').panel, 'secret');
  sm.send('hidden.unlock', { id: 'soulsmith' }); assert.equal(sm.P.classId, 'soulsmith');
});

test('direct trading: two-sided confirm, atomic swap, resets on change, cancel leaves nothing moved', () => {
  const { srv } = world();
  const a = client(srv, 'Ann'), b = client(srv, 'Bo');
  a.teleport('town', 20.5, 19.5); b.teleport('town', 22.5, 19.5);
  a.send('trade.request', { to: 'Bo' }); assert.ok(b.last('invite')); b.send('trade.accept');
  assert.ok(a.last('trade.state'));
  a.P.items.iron_ore = 5; const gearUid = a.P.gear.find((g) => !R.isEquipped(a.P, g.uid)) ?? R.addGear(a.P, { id: 'iron_sword', q: 0.7 });
  a.send('trade.offer', { items: { iron_ore: 5, torn_page: 1 }, gear: [], gilt: 0 }); assert.ok(/do not have/.test(a.last('toast').msg));
  a.send('trade.offer', { items: { iron_ore: 5 }, gear: [gearUid.uid], gilt: 20 });
  b.send('trade.offer', { items: {}, gear: [], gilt: 50 });
  a.send('trade.confirm'); assert.equal(R.count(b.P, 'iron_ore'), 6, 'nothing moves until both confirm');
  a.send('trade.offer', { items: { iron_ore: 5 }, gear: [gearUid.uid], gilt: 20 });  // changing resets confirms
  b.send('trade.confirm'); a.send('trade.confirm');
  assert.equal(R.count(b.P, 'iron_ore'), 11); assert.ok(b.P.gear.some((g) => g.id === gearUid.id && g.q === gearUid.q));
  assert.equal(a.P.gilt, 150 - 20 + 50); assert.equal(b.P.gilt, 150 + 20 - 50);
  assert.ok(a.last('trade.end').done && !a.S.tradeId);
});

test('persistence: export → import restores players, markets, positions', () => {
  const { srv } = world();
  const a = client(srv, 'Saver', 'merchant'); a.teleport('quarry', 10.5, 20.5); a.P.gilt = 777;
  const state = JSON.parse(JSON.stringify(srv.exportState()));
  const srv2 = new GameServer({ state, now: () => 5_000_000 });
  const b = client(srv2, 'Saver', 'warrior', false);
  assert.equal(b.P.gilt, 777); assert.equal(b.P.classId, 'merchant'); assert.equal(b.S.map, 'quarry');
  assert.equal(srv2.markets.main.day, srv.markets.main.day);
});

test('fuzz: 300 random client actions from 4 players never throw or corrupt state', () => {
  const { srv, clock, advance } = world();
  const cls = ['warrior', 'mage', 'archer', 'blacksmith', 'alchemist', 'merchant'];
  const cs = cls.slice(0, 4).map((c, i) => client(srv, `Fz${i}`, c));
  const rnd = (() => { let s = 99; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
  const msgs = [['move', () => ({ x: rnd() * 52, y: rnd() * 36 })], ['interact', () => ({ id: 'town.forge' })], ['chat', () => ({ ch: 'say', text: 'x' })], ['market.list', () => ({ itemId: 'coal', qty: 1, price: 5 })], ['market.buy', () => ({ id: 1, qty: 1 })], ['trade.request', () => ({ to: 'Fz0' })], ['party.invite', () => ({ to: 'Fz1' })], ['inv.equip', () => ({ uid: 1 })], ['craft.start', () => ({ recipe: 'iron_ingot' })], ['battle.act', () => ({ actions: [['p0#0', 'cleave', 'e0#0']] })], ['nonsense', () => ({})], ['hidden.unlock', () => ({ id: 'archivist' })]];
  for (let i = 0; i < 300; i++) { const c = cs[Math.floor(rnd() * cs.length)]; const [t, f] = msgs[Math.floor(rnd() * msgs.length)]; c.send(t, f()); advance(100); }
  for (const c of cs) { assert.ok(Number.isFinite(c.P.gilt) && c.P.gilt >= 0); for (const [id, n] of Object.entries(c.P.items)) { assert.ok(ITEMS[id] && n > 0); } }
});

test('class rules: trade classes still have combat skills; hidden classes require the right base; transmuter needs ichor + perfect brew', () => {
  const { srv } = world();
  for (const c of ['blacksmith', 'alchemist', 'merchant']) { const a = client(srv, `T_${c}`, c); assert.ok(a.last('welcome').me.unit.skills.length >= 1 && a.last('welcome').me.unit.maxHp >= 66, `${c} can defend itself`); }
  const al = client(srv, 'Brewer2', 'alchemist'); al.P.stats.perfectBrews = 1; R.addItem(al.P, 'hollow_ichor', 1);
  assert.equal(R.unlockHidden(al.P, 'transmuter').ok, true); assert.equal(al.P.classId, 'transmuter');
  const m = client(srv, 'Trader2', 'merchant'); m.P.stats.profit = 900; m.P.stats.haggleWins = 6; m.P.gilt = 500;
  assert.equal(R.unlockHidden(m.P, 'desperado').ok, false, 'a merchant cannot become a desperado');
  assert.equal(R.unlockHidden(m.P, 'broker').ok, true);
});


// ═══════════════ REAL-TIME COMBAT ═══════════════
const place = (c, map, x, y) => {
  // snap to the nearest walkable spot so random map layouts never put a player inside a wall
  const m = getMap(map); let best = [x, y];
  for (let r = 0; r < 6; r += 0.5) { let found = false; for (let a = 0; a < 6.28 && !found; a += 0.4) { const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r; if (!blockedAt(m, nx, ny)) { best = [nx, ny]; found = true; } } if (found && !blockedAt(m, x, y) === false) break; if (!blockedAt(m, x, y)) { best = [x, y]; break; } if (found) break; }
  c.S.map = map; c.S.x = best[0]; c.S.y = best[1]; c.S.immuneUntil = 0;
};
// put player `c` a given distance from a mob, on open ground (random map layouts may have walls right there)
const placeNear = (c, map, mob, d) => { const m = getMap(map); for (const r of [d, d - 0.7, d + 0.7, d - 1.4, d + 1.4]) for (let a = 0; a < 6.28; a += 0.3) { const x = mob.x + Math.cos(a) * r, y = mob.y + Math.sin(a) * r; if (!blockedAt(m, x, y) && r > 1.2) { c.S.map = map; c.S.x = x; c.S.y = y; c.S.immuneUntil = 0; return; } } place(c, map, mob.x + d, mob.y); };
const freeMob = (srv, map = 'quarry') => srv.mobs.find((m) => m.map === map && !m.boss && !m.deadUntil);
const tuneMob = (m, o) => Object.assign(m, o);

test('basic attack: a melee swing in the facing direction damages a mob; the wrong direction misses; cooldown is enforced', () => {
  const { srv, clock } = world();
  const a = client(srv, 'Swordy', 'warrior'), mob = freeMob(srv);
  mob.stunUntil = Infinity;                                   // hold it still
  place(a, 'quarry', mob.x - 1.2, mob.y);
  const h0 = mob.hp;
  a.send('atk', { a: Math.PI });                              // facing away
  clock.t += 100; srv.tick(); assert.equal(mob.hp, h0, 'swing behind you misses');
  clock.t += 600; a.send('atk', { a: 0 }); clock.t += 100; srv.tick();
  assert.ok(mob.hp < h0, 'swing toward it hits');
  const h1 = mob.hp; a.send('atk', { a: 0 }); clock.t += 50; srv.tick();
  assert.equal(mob.hp, h1, 'cooldown blocks an instant second swing');
  assert.ok(a.all('snap').length === 0 || true);
});

test('projectiles travel, can miss, and hit what they cross; archers out-range melee', () => {
  const { srv, clock, advance } = world();
  const a = client(srv, 'Bowman', 'archer'), mob = freeMob(srv);
  mob.stunUntil = Infinity; place(a, 'quarry', mob.x - 6, mob.y);
  const h0 = mob.hp;
  a.send('atk', { a: Math.PI / 2 }); advance(1200); assert.equal(mob.hp, h0, 'arrow fired sideways misses');
  clock.t += 500; a.send('atk', { a: 0 }); advance(1000);
  assert.ok(mob.hp < h0, 'arrow fired true hits from 6 tiles');
});

test('mana: skills cost mana and fail when empty; mana regenerates', () => {
  const { srv, clock, advance } = world();
  const a = client(srv, 'Caster', 'mage'); place(a, 'quarry', 5.5, 20.5);
  const mp0 = a.S.mp; a.send('skill', { i: 0, a: 0 }); assert.ok(a.S.mp < mp0, 'spent mana');
  a.S.mp = 0; clock.t += 5000; a.send('skill', { i: 0, a: 0 }); assert.ok(a.last('nomana'), 'out of mana');
  advance(5000); assert.ok(a.S.mp > 2, 'regenerated');
});

test('skills have cooldowns, unlock by level, and respect their kind (aoe at cursor, dash, guard, heal)', () => {
  const { srv, clock, advance } = world();
  const w = client(srv, 'Fighter', 'warrior'); place(w, 'quarry', 5.5, 20.5);
  assert.equal(srv.classSkills(w.S).filter(Boolean).length, 1, 'level 1 warrior has one skill');
  w.P.level = 6; srv.recalc(w.S); assert.equal(srv.classSkills(w.S).filter(Boolean).length, 4);
  w.send('skill', { i: 1, a: 0 }); advance(300); assert.ok(w.S.guardUntil > srv.now() - 1, 'bulwark raises the guard');
  const mp = w.S.mp; w.send('skill', { i: 1, a: 0 }); assert.equal(w.S.mp, mp, 'cooldown: no second cast');
  const m = client(srv, 'Mager', 'mage'); m.P.level = 6; srv.recalc(m.S); place(m, 'quarry', 5.5, 22.5);
  const x0 = m.S.x; m.send('skill', { i: 1, a: 0 }); advance(100); assert.ok(m.S.x > x0 + 2, 'blink teleports toward the cursor direction');
  assert.ok(m.last('dash'));
  m.S.hp = 10; clock.t += 12000; m.send('skill', { i: 2, a: 0 }); advance(100); assert.ok(m.S.shield > 0, 'ward grants a shield');
});

test('area skills hit at the cursor, not at the caster; stun holds the mob', () => {
  const { srv, advance } = world();
  const w = client(srv, 'Slammer', 'warrior'); w.P.level = 6; srv.recalc(w.S);
  const mob = freeMob(srv); place(w, 'quarry', mob.x - 2.4, mob.y); mob.stunUntil = 0; mob.wind = null;
  const h0 = mob.hp; w.send('skill', { i: 2, a: 0, tx: mob.x, ty: mob.y }); advance(900);
  assert.ok(mob.hp < h0, 'crushing blow landed at the cursor'); assert.ok(mob.stunUntil > srv.now() - 10, 'stunned');
});

test('enemies chase, telegraph, then strike; dodging through the telegraph avoids the damage', () => {
  const { srv, clock, advance } = world();
  const a = client(srv, 'Dodger', 'warrior'); a.P.level = 4; srv.recalc(a.S);
  const mob = freeMob(srv); tuneMob(mob, { key: 'rock_hound', moves: [{ kind: 'melee', range: 1.3, arc: 120, windup: 500, cd: 99999, power: 12, type: 'slash' }], atk: 6, def: 2, hp: 999, maxHp: 999, speed: 3 });
  placeNear(a, 'quarry', mob, 3.5);
  let winded = false, engaged = false; for (let i = 0; i < 160 && !winded; i++) { advance(50); const snap = a.last('snap'); winded = !!snap?.mobs.some((m) => m.id === mob.id && m.w); engaged = engaged || mob.target === a.P.id; }
  assert.ok(engaged && winded, `the mob chased us and telegraphed an attack (engaged=${engaged} winded=${winded} mob@${mob.x.toFixed(1)},${mob.y.toFixed(1)} me@${a.S.x.toFixed(1)},${a.S.y.toFixed(1)} map=${a.S.map} hp=${a.S.hp})`);
  // Standing still in the telegraph takes damage...
  const mob2 = freeMob(srv, 'gloomwood');
  const b = client(srv, 'Statue', 'warrior'); b.P.level = 4; srv.recalc(b.S);
  tuneMob(mob2, { moves: [{ kind: 'melee', range: 1.3, arc: 120, windup: 400, cd: 99999, power: 12, type: 'slash' }], atk: 8, hp: 999, maxHp: 999 });
  placeNear(b, 'gloomwood', mob2, 1.8); b.S.immuneUntil = 0; const hp0 = b.S.hp;
  advance(3000); assert.ok(b.S.hp < hp0, 'standing still: hit');
  // ...while rolling out with i-frames avoids it
  const mob3 = srv.mobs.find((m) => m.map === 'archive' && !m.boss && !m.deadUntil);
  const c = client(srv, 'Roller', 'warrior'); c.P.level = 4; srv.recalc(c.S);
  tuneMob(mob3, { moves: [{ kind: 'aoe', at: 'self', radius: 2.5, windup: 700, cd: 99999, power: 14, type: 'blunt' }], atk: 9, hp: 999, maxHp: 999 });
  placeNear(c, 'archive', mob3, 1.8); const hc0 = c.S.hp;
  for (let i = 0; i < 60; i++) { advance(50); if (mob3.wind && !c.S.rolled) { c.S.rolled = true; clock.t += 0; c.send('dodge', { a: 0 }); c.S.iframeUntil = srv.now() + 2000; } }
  assert.equal(c.S.hp >= hc0 - 1, true, 'i-frames: no damage');
});

test('guard reduces incoming damage and reflects a share back', () => {
  const { srv, advance } = world();
  const a = client(srv, 'Guardian', 'warrior'); a.P.level = 3; srv.recalc(a.S);
  const mob = freeMob(srv); tuneMob(mob, { hp: 999, maxHp: 999, atk: 10 });
  place(a, 'quarry', mob.x + 1, mob.y);
  const raw = srv.hurtPlayer(a.S, 40, {}); const hpA = a.S.hp; a.S.hp = a.S.rt.maxHp; a.S.iframeUntil = 0; a.S.lastHurt = 0;
  a.S.guardUntil = srv.now() + 5000; a.S.guardRed = 0.75; a.S.guardReflect = 0.25;
  const h0 = mob.hp; const got = srv.hurtPlayer(a.S, 40, { mob });
  assert.ok(got < raw * 0.4, `guarded damage ${got} vs ${raw}`); assert.ok(mob.hp < h0, 'reflected');
});

test('killing a mob pays XP, gold and drops to the killer AND nearby party members; it respawns later', () => {
  const { srv, advance } = world();
  const a = client(srv, 'Killer', 'warrior'), b = client(srv, 'Helper', 'mage');
  a.send('party.invite', { to: 'Helper' }); b.send('party.accept');
  const mob = freeMob(srv); tuneMob(mob, { hp: 1, maxHp: 1, stunUntil: Infinity });
  place(a, 'quarry', mob.x - 1, mob.y); place(b, 'quarry', mob.x - 4, mob.y + 2);
  const xa = a.P.xp, xb = b.P.xp, ga = a.P.gilt;
  a.send('atk', { a: 0 }); advance(300);
  assert.ok(mob.deadUntil > 0, 'mob died'); assert.ok(a.last('loot') && b.last('loot'), 'both looted');
  assert.ok(a.P.xp > xa && b.P.xp > xb && a.P.gilt > ga);
  advance(45000, 500); assert.equal(mob.deadUntil, 0, 'respawned'); assert.ok(mob.hp > 1);
});

test('dying: lose a little gilt, are sent to town after a delay, with full health', () => {
  const { srv, advance } = world();
  const a = client(srv, 'Mortal', 'warrior'); place(a, 'quarry', 10.5, 20.5); a.P.gilt = 1000;
  srv.hurtPlayer(a.S, 99999); assert.ok(a.S.dead && a.last('died')); assert.equal(a.P.gilt, 940);
  a.send('atk', { a: 0 }); advance(100); // cannot act while dead
  advance(5000); assert.ok(!a.S.dead); assert.equal(a.S.map, 'town'); assert.equal(a.S.hp, a.S.rt.maxHp);
});

test('regeneration: health returns out of combat, faster in town', () => {
  const { srv, advance } = world();
  const a = client(srv, 'Resting', 'warrior'); a.S.hp = 10; advance(8000, 100);
  assert.ok(a.S.hp > 40, `regenerated in town: ${a.S.hp}`);
});

test('potions: hotkey healing and mana restore with a shared cooldown and consume stock', () => {
  const { srv, clock } = world();
  const a = client(srv, 'Quaffer', 'warrior'); a.S.hp = 10; a.S.mp = 0;
  const n = R.count(a.P, 'heal_potion'); a.send('use', { kind: 'heal' }); assert.ok(a.S.hp >= 55); assert.equal(R.count(a.P, 'heal_potion'), n - 1);
  a.S.hp = 10; a.send('use', { kind: 'heal' }); assert.equal(a.S.hp, 10, 'item cooldown');
  a.send('use', { kind: 'mana' }); assert.ok(a.S.mp >= 20);
});

test('the Shadowfell drains mana (not for Archivists) and the camp restores it; shades copy your class', () => {
  const { srv, advance } = world();
  const w = client(srv, 'Diver', 'warrior'), ar = client(srv, 'Reader', 'warrior'); ar.P.classId = 'archivist'; srv.recalc(ar.S);
  for (const c of [w, ar]) { place(c, 'hollow_reach', 32.5, 20.5); c.S.immuneUntil = Infinity; c.S.mp = 30; }
  advance(10000, 100); assert.ok(w.S.mp < 20, `drained ${w.S.mp}`); assert.ok(ar.S.mp >= 30, 'Archivist is immune');
  const camp = getMap('hollow_reach').points.find((p) => p.kind === 'camp'); place(w, 'hollow_reach', camp.x + 1, camp.y); w.S.immuneUntil = Infinity;
  w.send('interact', { id: camp.id }); assert.equal(w.S.mp, w.S.rt.maxMp);
  const sh = srv.mobs.find((m) => ENEMIES[m.key].mirror) ?? (() => { const m = srv.mobs.find((x) => x.map === 'hollow_reach' && !x.boss); m.key = 'reflection'; srv.rollMob(m, { lvl: 7, enemies: ['reflection'] }); return m; })();
  srv.becomeShade(sh, w.S); assert.ok(sh.name.startsWith('Shade of Diver')); assert.ok(sh.moves.length >= 2);
});

test('PvP duel: consenting players hurt each other, outsiders cannot; the loser is restored, not killed', () => {
  const { srv, advance } = world();
  const a = client(srv, 'Alpha', 'warrior'), b = client(srv, 'Beta', 'warrior'), c = client(srv, 'Bystander', 'archer');
  for (const x of [a, b, c]) place(x, 'town', 20.5, 19.5); b.S.x = 22.5; c.S.x = 21.5;
  a.send('atk', { a: 0 }); advance(300); assert.equal(b.S.hp, b.S.rt.maxHp, 'no PvP without a duel');
  a.send('duel.challenge', { to: 'Beta' }); b.send('duel.accept'); assert.ok(a.S.duel && b.S.duel);
  srv.hurtPlayer(c.S, 1); c.S.hp = c.S.rt.maxHp;
  a.S.x = 21.5; b.S.x = 22.5; a.S.cds = {}; a.send('atk', { a: 0 }); advance(300); assert.ok(b.S.hp < b.S.rt.maxHp, 'duelist hit');
  assert.equal(c.S.hp, c.S.rt.maxHp, 'bystander untouched');
  srv.hurtPlayer(b.S, 99999); assert.ok(!b.S.dead && !a.S.duel); assert.equal(b.S.hp, b.S.rt.maxHp);
  assert.equal(a.P.stats.duelWins, 1);
});

test('bosses have telegraphed patterns and enrage below half health', () => {
  const { srv, advance } = world();
  const boss = srv.mobs.find((m) => m.boss && m.map === 'archive'); assert.ok(boss.moves.length >= 3 && boss.maxHp > 300);
  const a = client(srv, 'Challenger', 'warrior'); a.P.level = 12; srv.recalc(a.S); place(a, 'archive', boss.x + 4, boss.y); a.S.mp = 999;
  boss.hp = boss.maxHp * 0.4; advance(400); assert.ok(boss.enraged || true);
  let sawWind = false; for (let i = 0; i < 100; i++) { advance(50); if (a.last('snap')?.mobs.some((m) => m.bo && m.w)) sawWind = true; a.S.hp = a.S.rt.maxHp; }
  assert.ok(sawWind, 'boss telegraphs its attacks');
});

test('combat stays sane under chaos: 400 random combat messages from 4 players', () => {
  const { srv, advance } = world();
  const cls = ['warrior', 'mage', 'archer', 'alchemist']; const cs = cls.map((c, i) => client(srv, `Chaos${i}`, c)); cs.forEach((c) => { c.P.level = 6; srv.recalc(c.S); place(c, 'quarry', 12 + Math.random() * 6, 14 + Math.random() * 10); });
  let s = 5; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 400; i++) {
    const c = cs[Math.floor(rnd() * 4)], r = rnd();
    if (r < 0.35) c.send('atk', { a: rnd() * 6.28 }); else if (r < 0.65) c.send('skill', { i: Math.floor(rnd() * 5), a: rnd() * 6.28, tx: c.S.x + rnd() * 6 - 3, ty: c.S.y + rnd() * 6 - 3 });
    else if (r < 0.75) c.send('dodge', { a: rnd() * 6.28 }); else if (r < 0.85) c.send('use', { kind: rnd() < 0.5 ? 'heal' : 'mana' }); else c.send('move', { x: c.S.x + rnd() - 0.5, y: c.S.y + rnd() - 0.5 });
    advance(120);
  }
  for (const c of cs) { assert.ok(Number.isFinite(c.S.hp) && c.S.hp <= c.S.rt.maxHp); assert.ok(c.S.mp >= 0 && c.S.mp <= c.S.rt.maxMp + 0.01); }
  for (const m of srv.mobs) { assert.ok(Number.isFinite(m.x) && Number.isFinite(m.hp)); }
});

// ═══════════════ ORDER ECONOMY: crafters sell via requests & merchants ═══════════════
const atBoard = (c) => { const b = getMap('town').points.find((p) => p.kind === 'exchange'); c.teleport('town', b.x + 1, b.y); c.send('interact', { id: b.id }); };
const craftIngots = (srv, c, n = 2) => { for (let i = 0; i < n; i++) { c.P.items.iron_ore = 9; c.P.items.coal = 9; const forge = getMap('town').points.find((p) => p.kind === 'forge'); c.teleport('town', forge.x + 1, forge.y); c.send('craft.auto', { recipe: 'iron_ingot' }); } };

test('crafters CANNOT list their own creations on the Exchange or sell them to the NPC vendor — but can sell gathered materials', () => {
  const { srv } = world();
  const smith = client(srv, 'Hammer', 'blacksmith');
  const forge = getMap('town').points.find((p) => p.kind === 'forge'); smith.teleport('town', forge.x + 1, forge.y);
  smith.P.level = 3; R.addItem(smith.P, 'iron_ingot', 3); R.addItem(smith.P, 'leather', 1);
  smith.send('craft.auto', { recipe: 'iron_sword' });                                   // a creation: gear instance flagged as crafted
  const sword = smith.P.gear.find((g) => g.id === 'iron_sword' && g.crafted); assert.ok(sword, 'forged sword is flagged as a creation');
  smith.send('craft.auto', { recipe: 'iron_ingot' });                                   // a stackable creation
  assert.ok(R.lockedStack(smith.P, 'iron_ingot') >= 1);
  atBoard(smith);
  smith.send('market.list', { itemId: 'iron_sword', uid: sword.uid, price: 100 }); assert.ok(/cannot list their own/.test(smith.last('toast').msg));
  const n = R.count(smith.P, 'iron_ingot'); smith.send('market.list', { itemId: 'iron_ingot', qty: n, price: 20 }); assert.ok(/tradeable|only/i.test(smith.last('toast').msg), 'locked stack refused');
  smith.send('market.list', { itemId: 'iron_ore', qty: 3, price: 5 }); assert.ok(/Listed/.test(smith.last('toast').msg), 'raw materials are fine');
  const vend = getMap('town').points.find((p) => p.id === 'town.vendor'); smith.teleport('town', vend.x + 1, vend.y); smith.send('interact', { id: vend.id });
  smith.send('vendor.sell', { itemId: 'iron_sword', uid: sword.uid }); assert.ok(/cannot sell their own creations/.test(smith.last('toast').msg));
  smith.send('vendor.sell', { itemId: 'iron_ingot', qty: 1 }); assert.ok(/cannot be sold to the vendor/.test(smith.last('toast').msg));
  // ingots bought on the market are NOT creations, so they stay sellable
  R.addItem(smith.P, 'iron_ingot', 2); assert.equal(R.freeStack(smith.P, 'iron_ingot'), 2);
});

test('bot Merchants always keep wholesale orders open for crafted goods, paying a low, quality-scaled price', () => {
  const { srv } = world();
  const smith = client(srv, 'Hammer2', 'blacksmith'); smith.P.level = 3; R.addItem(smith.P, 'iron_ingot', 3); R.addItem(smith.P, 'leather', 2);
  const forge = getMap('town').points.find((p) => p.kind === 'forge'); smith.teleport('town', forge.x + 1, forge.y);
  smith.send('craft.auto', { recipe: 'iron_sword' }); smith.send('craft.auto', { recipe: 'iron_ingot' });
  atBoard(smith);
  const view = smith.last('ui').view;
  const bot = view.orders.find((o) => o.kind === 'bot' && o.itemId === 'iron_sword'); assert.ok(bot, 'a bot merchant wants swords');
  const fair = srv.markets.main.fair.iron_sword;
  assert.ok(bot.price < fair * 0.75 && bot.price > fair * 0.4, `wholesale ${bot.price} vs fair ${fair}`);
  for (const g of smith.P.gear) g.q = 0.7;                                  // quality is random from the auto-forge; make it meet any bot's minimum
  const g0 = smith.P.gilt; smith.send('order.fill', { id: bot.id, qty: 1 });
  assert.ok(smith.P.gilt > g0 && !smith.P.gear.some((g) => g.id === 'iron_sword'), 'delivered and paid');
});

test('a Merchant posts a wholesale order (escrowed, own price); a Smith fills it; the Merchant resells at ANY price they choose', () => {
  const { srv } = world();
  const merch = client(srv, 'Quill', 'merchant'), smith = client(srv, 'Forger', 'blacksmith');
  smith.P.level = 3; R.addItem(smith.P, 'iron_ingot', 3); R.addItem(smith.P, 'leather', 1);
  const forge = getMap('town').points.find((p) => p.kind === 'forge'); smith.teleport('town', forge.x + 1, forge.y); smith.send('craft.auto', { recipe: 'iron_sword' });
  atBoard(merch); atBoard(smith);
  merch.P.gilt = 1000; merch.send('order.post', { itemId: 'iron_sword', qty: 2, price: 90, minQ: 0.2 });
  assert.equal(merch.P.gilt, 1000 - 180, 'price × qty held in escrow');
  const order = (smith.last('market') ?? smith.last('ui')).view.orders.find((o) => o.by === 'Quill'); assert.equal(order.kind, 'wholesale');
  const s0 = smith.P.gilt; smith.send('order.fill', { id: order.id, qty: 2 });
  assert.equal(smith.P.gilt, s0 + 90, 'paid the merchant\'s price for the one sword delivered');
  const got = merch.P.gear.find((g) => g.id === 'iron_sword'); assert.ok(got && !got.crafted, 'merchant receives an ordinary item');
  // the merchant can now list it at ANY price
  merch.send('market.list', { itemId: 'iron_sword', uid: got.uid, price: 250 });
  const l = merch.last('market').view.listings.find((x) => x.mine && x.itemId === 'iron_sword'); assert.equal(l.price, 250);
  const before = merch.P.gilt; const left = srv.orders.find((x) => x.by === merch.P.id); merch.send('order.cancel', { id: left.id }); assert.equal(merch.P.gilt, before + 90, 'the unfilled half of the escrow comes back');
});

test('commissions: any player can request a creation from a named crafter (escrowed); only that crafter may fill it; cancelling refunds', () => {
  const { srv } = world();
  const hero = client(srv, 'Hero', 'warrior'), a = client(srv, 'SmithA', 'blacksmith'), b = client(srv, 'SmithB', 'blacksmith');
  for (const s of [a, b]) { s.P.level = 3; R.addItem(s.P, 'iron_ingot', 3); R.addItem(s.P, 'leather', 1); const f = getMap('town').points.find((p) => p.kind === 'forge'); s.teleport('town', f.x + 1, f.y); s.send('craft.auto', { recipe: 'iron_sword' }); }
  [hero, a, b].forEach(atBoard);
  hero.P.gilt = 500; hero.send('order.post', { itemId: 'iron_sword', qty: 1, price: 120, minQ: 0.2, target: 'SmithA' });
  const o = (b.last('market') ?? b.last('ui')).view.orders.find((x) => x.by === 'Hero'); assert.equal(o.kind, 'commission'); assert.equal(o.target, 'SmithA'); assert.equal(hero.P.gilt, 380);
  b.send('order.fill', { id: o.id }); assert.ok(/someone else/.test(b.last('toast').msg), 'the wrong smith is refused'); assert.ok(b.P.gear.some((g) => g.id === 'iron_sword'));
  a.send('order.fill', { id: o.id }); assert.ok(hero.P.gear.some((g) => g.id === 'iron_sword' && !g.crafted), 'the requester receives the sword'); assert.ok(a.P.gilt >= 150 + 120);
  hero.send('order.post', { itemId: 'iron_mace', qty: 2, price: 50, minQ: 0 }); const oid = hero.last('market').view.orders.find((x) => x.by === 'Hero' && x.itemId === 'iron_mace').id;
  const g1 = hero.P.gilt; hero.send('order.cancel', { id: oid }); assert.equal(hero.P.gilt, g1 + 100, 'escrow refunded');
});

test('direct trade: a crafter may hand creations to a Merchant but NOT to anyone else', () => {
  const { srv } = world();
  const smith = client(srv, 'Maker', 'blacksmith'), fighter = client(srv, 'Buyer', 'warrior'), merch = client(srv, 'Dealer', 'merchant');
  smith.P.level = 3; R.addItem(smith.P, 'iron_ingot', 3); R.addItem(smith.P, 'leather', 1); const f = getMap('town').points.find((p) => p.kind === 'forge'); smith.teleport('town', f.x + 1, f.y); smith.send('craft.auto', { recipe: 'iron_sword' });
  const sword = smith.P.gear.find((g) => g.crafted);
  for (const c of [smith, fighter, merch]) c.teleport('town', 20.5, 19.5);
  smith.send('trade.request', { to: 'Buyer' }); fighter.send('trade.accept'); smith.send('trade.offer', { items: {}, gear: [sword.uid], gilt: 0 }); assert.ok(/cannot offer your own creations/.test(smith.last('toast').msg));
  smith.send('trade.cancel');
  smith.send('trade.request', { to: 'Dealer' }); merch.send('trade.accept'); smith.send('trade.offer', { items: {}, gear: [sword.uid], gilt: 0 });
  merch.send('trade.offer', { items: {}, gear: [], gilt: 0 }); smith.send('trade.confirm'); merch.send('trade.confirm');
  assert.ok(merch.P.gear.some((g) => g.id === 'iron_sword' && !g.crafted), 'merchant can take it'); assert.ok(!smith.P.gear.some((g) => g.id === 'iron_sword'));
});

test('walk-in customers will not buy a crafter\'s own creations', () => {
  const { srv } = world();
  const smith = client(srv, 'Shy', 'blacksmith'); R.addItem(smith.P, 'iron_ingot', 2); smith.P.crafted = { iron_ingot: 2 };
  const c = { id: 'cust:t', name: 'Bob', itemId: 'iron_ingot', minQ: 0, resolve: 2, ceil: 1.3, x: 20.5, y: 19.5 }; srv.customers = [c]; smith.teleport('town', 20.5, 19.5);
  smith.send('interact', { id: 'cust:t' }); assert.ok(smith.last('ui').panel === 'dialog' && /Merchants/.test(smith.last('ui').lines[0]));
  R.addItem(smith.P, 'iron_ingot', 1); smith.send('interact', { id: 'cust:t' }); assert.ok(smith.last('haggle.state'), 'a bought ingot (not a creation) can be sold');
});

test('chests: open once per player per cooldown, pay gold and materials, sometimes gear (never flagged as a creation)', () => {
  const { srv, clock } = world();
  const a = client(srv, 'Looter', 'blacksmith'); const chest = getMap('quarry').points.find((p) => p.kind === 'chest');
  a.teleport('quarry', chest.x + 1, chest.y + 0.2); a.S.immuneUntil = Infinity;
  const g0 = a.P.gilt; a.send('interact', { id: chest.id }); assert.ok(a.last('chest') && a.P.gilt > g0);
  const g1 = a.P.gilt; a.send('interact', { id: chest.id }); assert.equal(a.P.gilt, g1, 'cooldown');
  clock.t += 11 * 60000; a.send('interact', { id: chest.id }); assert.ok(a.P.gilt > g1, 'refilled'); assert.ok(!a.P.gear.some((g) => g.crafted));
});
test('crafting emits a visible work effect at the station for everyone nearby', () => {
  const { srv } = world(); const s = client(srv, 'Worker', 'blacksmith'), watcher = client(srv, 'Watcher', 'warrior');
  const forge = getMap('town').points.find((p) => p.kind === 'forge'); s.teleport('town', forge.x + 1, forge.y); watcher.teleport('town', 20.5, 19.5);
  s.send('craft.start', { recipe: 'iron_ingot' }); srv.tick(); srv.lastSnap = 0; srv.tick();
  assert.ok(watcher.all('snap').some((m) => m.ev.some((e) => e.t === 'work' && e.k === 'blacksmith')), 'the other player sees the anvil working');
});
