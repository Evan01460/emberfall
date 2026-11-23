import test from 'node:test';
import assert from 'node:assert/strict';
import { GameServer } from '../src/server/gameserver.js';
import { getMap } from '../src/world.js';
import * as R from '../src/rules.js';
import { REQ } from '../src/server/requests.js';

function world() { const clock = { t: 1_000_000 }; const srv = new GameServer({ seed: 11, now: () => clock.t }); return { srv, clock, advance(ms) { for (let i = 0; i < ms; i += 50) { clock.t += 50; srv.tick(); } } }; }
function client(srv, name, classId = 'warrior') {
  const conn = { msgs: [], send(m) { this.msgs.push(JSON.parse(JSON.stringify(m))); }, session: null };
  assert.ok(srv.join(conn, { name, create: { classId } }).ok);
  const c = { conn, S: conn.session, P: conn.session.P, send: (t, d = {}) => srv.handle(conn, { t, ...d }), last: (t) => [...conn.msgs].reverse().find((m) => m.t === t), toasts: () => conn.msgs.filter((m) => m.t === 'toast').map((m) => m.msg) };
  return c;
}
const setup = () => { const w = world(); const buyer = client(w.srv, 'Buyer', 'warrior'), smith = client(w.srv, 'Smith', 'blacksmith'); buyer.P.gilt = 1000; smith.P.level = 5; return { ...w, buyer, smith }; };

test('requests: the payment is escrowed, a rejection or cancellation refunds it, and only crafters can be asked', () => {
  const { srv, buyer, smith } = setup(); const mage = client(srv, 'Mage', 'mage');
  buyer.send('req.new', { to: 'Mage', itemId: 'iron_sword', price: 100 }); assert.equal(srv.reqs.length, 0, 'a mage is not a crafter'); assert.equal(buyer.P.gilt, 1000);
  buyer.send('req.new', { to: 'Smith', itemId: 'heal_potion', price: 100 }); assert.equal(srv.reqs.length, 0, 'a blacksmith does not make potions');
  buyer.send('req.new', { to: 'Smith', itemId: 'iron_sword', minQ: 0.5, price: 150 }); assert.equal(srv.reqs.length, 1); assert.equal(buyer.P.gilt, 850, '150g held in escrow');
  assert.ok(smith.conn.msgs.some((m) => m.t === 'chat' && /requests 1× Iron Sword/.test(m.text)), 'the smith is told'); assert.equal(smith.last('reqs').list[0].mine, 'to'); assert.equal(buyer.last('reqs').list[0].mine, 'from');
  smith.send('req.reject', { id: srv.reqs[0].id }); assert.equal(buyer.P.gilt, 1000, 'rejected: nothing happens, the money is back'); assert.equal(srv.reqs[0].status, 'rejected');
  buyer.send('req.new', { to: 'Smith', itemId: 'iron_sword', price: 90 }); buyer.send('req.cancel', { id: srv.reqs[1].id }); assert.equal(buyer.P.gilt, 1000); assert.equal(srv.reqs[1].status, 'cancelled');
  buyer.P.gilt = 50; buyer.send('req.new', { to: 'Smith', itemId: 'iron_sword', price: 90 }); assert.equal(srv.reqs.length, 2, 'cannot pay the escrow');
});

test('requests: something above the crafter\'s level can only be rejected', () => {
  const { srv, buyer, smith } = setup(); smith.P.level = 2; const rec = R.RECIPES?.length; void rec;
  buyer.send('req.new', { to: 'Smith', itemId: 'steel_plate', price: 400 }); const r = srv.reqs[0]; assert.ok(r, 'it can be asked for');
  assert.equal(smith.last('reqs').list[0].canMake, false); assert.ok(smith.last('reqs').list[0].needLvl > 2);
  smith.send('req.accept', { id: r.id }); assert.equal(r.status, 'pending', 'accepting is refused'); assert.ok(smith.toasts().some((t) => /level/.test(t)));
  smith.send('req.reject', { id: r.id }); assert.equal(r.status, 'rejected'); assert.equal(buyer.P.gilt, 1000);
});

test('requests: negotiate a price, accept, tell them it is ready, deliver — the item moves and the escrow pays the crafter', () => {
  const { srv, buyer, smith } = setup(); buyer.send('req.new', { to: 'Smith', itemId: 'iron_sword', minQ: 0.6, price: 100 }); const r = srv.reqs[0];
  smith.send('req.offer', { id: r.id, price: 160 }); buyer.send('req.answer', { id: r.id, accept: true }); assert.equal(r.price, 160); assert.equal(buyer.P.gilt, 840, 'the escrow grew with the agreed price');
  buyer.send('req.offer', { id: r.id, price: 120 }); smith.send('req.answer', { id: r.id, accept: false }); assert.equal(r.price, 160, 'a declined proposal changes nothing');
  buyer.send('req.offer', { id: r.id, price: 130 }); smith.send('req.answer', { id: r.id, accept: true }); assert.equal(r.price, 130); assert.equal(buyer.P.gilt, 870, 'a lower price refunds the difference');
  smith.send('req.ready', { id: r.id }); assert.equal(r.ready, false, 'not accepted yet'); smith.send('req.accept', { id: r.id }); assert.equal(r.status, 'accepted');
  smith.send('req.ready', { id: r.id }); assert.equal(r.ready, false, 'nothing fitting in the satchel'); smith.send('req.deliver', { id: r.id }); assert.equal(r.status, 'accepted');
  R.addGear(smith.P, { id: 'iron_sword', q: 0.5, crafted: true, by: 'Smith' }); smith.send('req.ready', { id: r.id }); assert.equal(r.ready, false, 'quality 50% is below the 60% asked for');
  R.addGear(smith.P, { id: 'iron_sword', q: 0.72, crafted: true, by: 'Smith' }); smith.send('req.ready', { id: r.id }); assert.equal(r.ready, true); assert.ok(buyer.conn.msgs.some((m) => m.t === 'chat' && /is ready/.test(m.text)), 'the requester is told');
  const gold = smith.P.gilt, swords = buyer.P.gear.length; smith.send('req.deliver', { id: r.id });
  assert.equal(r.status, 'done'); assert.equal(smith.P.gilt, gold + 130); assert.equal(buyer.P.gear.length, swords + 1); const got = buyer.P.gear.at(-1); assert.equal(got.id, 'iron_sword'); assert.equal(got.q, 0.72); assert.equal(got.by, 'Smith'); assert.ok(!got.crafted, 'no longer locked for the new owner');
  assert.ok(smith.P.gear.some((g) => g.q === 0.5), 'the poor one stayed with the smith'); assert.equal(srv.reqs.length, 1);
});

test('requests: potions come from the alchemist\'s stack, expire after 72 h with a refund, and survive a restart', () => {
  const w = world(), { srv, advance } = w; const buyer = client(srv, 'Buyer', 'warrior'), al = client(srv, 'Brew', 'alchemist'); buyer.P.gilt = 500; al.P.level = 3;
  const pots0 = R.count(buyer.P, 'heal_potion'); buyer.send('req.new', { to: 'Brew', itemId: 'heal_potion', qty: 3, price: 60 }); const r = srv.reqs[0]; al.send('req.accept', { id: r.id });
  al.P.items = {}; R.addItem(al.P, 'heal_potion', 2); al.P.crafted = { heal_potion: 2 }; al.send('req.deliver', { id: r.id }); assert.equal(r.status, 'accepted', 'two potions are not three');
  R.addItem(al.P, 'heal_potion', 1); al.P.crafted.heal_potion = 3; al.send('req.deliver', { id: r.id }); assert.equal(r.status, 'done'); assert.equal(buyer.P.items.heal_potion, pots0 + 3); assert.equal(R.lockedStack(al.P, 'heal_potion'), 0);
  buyer.send('req.new', { to: 'Brew', itemId: 'heal_potion', price: 40 }); const q = srv.reqs[1]; const saved = JSON.parse(JSON.stringify(srv.exportState())); const s2 = new GameServer({ state: saved, now: () => 1_000_000 }); assert.equal(s2.reqs.length, 2, 'requests persist');
  srv.reqs[1].expires = srv.now() + 1000; advance(2000); assert.equal(q.status, 'expired'); assert.equal(buyer.P.gilt, 500 - 60, 'paid 60 for the potions; the second escrow (40) came back');
});

test('crafters can only sell what was requested: no direct trades of their creations to non-merchants, no exchange listing, no vendor', () => {
  const { srv, smith, buyer } = setup(); const g = R.addGear(smith.P, { id: 'iron_sword', q: 0.7, crafted: true, by: 'Smith' }); R.addItem(smith.P, 'iron_ingot', 3); smith.P.crafted = { iron_ingot: 3 };
  const merch = client(srv, 'Merch', 'merchant');
  assert.equal(srv.validOffer(smith.P, { items: {}, gear: [g.uid], flasks: [], gilt: 0 }, buyer.P), false, 'not to a warrior');
  assert.equal(srv.validOffer(smith.P, { items: { iron_ingot: 3 }, gear: [], flasks: [], gilt: 0 }, buyer.P), false);
  assert.equal(srv.validOffer(smith.P, { items: {}, gear: [g.uid], flasks: [], gilt: 0 }, merch.P), true, 'a Merchant may buy it');
  assert.equal(R.gearLocked(smith.P, g), true);
});

test('chests never hold gear any more', () => {
  const { srv } = world(); const w = client(srv, 'Looter', 'warrior'); let chests = 0;
  for (const mid of ['quarry', 'gloomwood', 'greenmeadow']) for (const chest of getMap(mid).points.filter((p) => p.kind === 'chest')) {
    w.S.map = mid; w.S.x = chest.x; w.S.y = chest.y + 1; w.P.cooldowns = {}; const n0 = w.P.gear.length; w.conn.msgs.length = 0; w.send('interact', { id: chest.id }); const m = w.conn.msgs.find((x) => x.t === 'chest');
    if (m) { chests++; assert.ok(!m.rows.some((r) => r.k === 'gear'), `${mid}: no gear rows`); assert.equal(w.P.gear.length, n0, 'no gear added'); }
  }
  assert.ok(chests >= 3, 'tested several chests');
});

test('enemies keep chasing until you are very far away, wait 10 s after the last hit, then heal slowly', () => {
  const { srv, clock, advance } = world(); const p = client(srv, 'Runner', 'warrior'); p.P.level = 30; srv.recalc(p.S); p.S.hp = p.S.rt.maxHp;
  const mob = srv.mobs.find((m) => m.map === 'quarry' && !m.boss); const map = getMap('quarry'); p.S.map = 'quarry'; p.S.x = mob.hx + 1; p.S.y = mob.hy; p.S.immuneUntil = 0; p.S.iframeUntil = 1e12;
  assert.equal(srv.mobTarget(mob, clock.t)?.id, p.S.id, 'it notices you'); mob.target = p.S.id;
  p.S.x = mob.x + 25; p.S.y = mob.y; assert.equal(srv.mobTarget(mob, clock.t)?.id, p.S.id, 'still following 25 tiles away, far from its spawn');
  p.S.x = mob.x + 40; assert.equal(srv.mobTarget(mob, clock.t), null, 'gives up only when you are very far');
  // healing
  mob.hp = mob.maxHp * 0.3; mob.lastHp = mob.hp; mob.hurtAt = clock.t; mob.target = null; p.S.x = mob.x + 3; p.S.y = mob.y; p.S.iframeUntil = 1e12; p.S.immuneUntil = 1e12; p.S.stealthUntil = 1e12;
  const hp0 = mob.hp; advance(9000); assert.equal(Math.round(mob.hp), Math.round(hp0), 'no healing for the first 10 s');
  advance(5000); assert.ok(mob.hp > hp0 && mob.hp < mob.maxHp * 0.4, `healing started, slowly (${(mob.hp / mob.maxHp).toFixed(2)})`);
  const before = mob.hp; advance(5000); assert.ok((mob.hp - before) / mob.maxHp < 0.12, 'about 2% of max HP per second');
});

import { sendChunked, chunkReader } from '../src/chunk.js';
import { PROTOCOL } from '../src/version.js';
test('public-world transport: big messages are chunked and reassembled intact, in any order; the welcome carries the protocol version', () => {
  const big = { t: 'ui', panel: 'exchange', view: { rows: Array.from({ length: 4000 }, (_, i) => ({ i, name: `item ${i}`, v: i * 1.5 })) } }, wire = [];
  assert.ok(JSON.stringify(big).length > 100000); sendChunked({ send: (m) => wire.push(JSON.parse(JSON.stringify(m))) }, big); assert.ok(wire.length > 5); assert.ok(wire.every((m) => JSON.stringify(m).length < 16000), 'no single message is large');
  const got = []; const read = chunkReader((m) => got.push(m)); for (const m of wire.slice().reverse()) read(m); assert.equal(got.length, 1); assert.deepEqual(got[0], big);
  const small = { t: 'ping', c: 1 }, w2 = []; sendChunked({ send: (m) => w2.push(m) }, small); assert.deepEqual(w2, [small], 'small messages are sent as they are');
  const interleaved = []; const rd = chunkReader((m) => interleaved.push(m.t)); const w3 = [], w4 = []; sendChunked({ send: (m) => w3.push(m) }, { ...big, t: 'a' }); sendChunked({ send: (m) => w4.push(m) }, { ...big, t: 'b' });
  for (let i = 0; i < Math.max(w3.length, w4.length); i++) { if (w3[i]) rd(w3[i]); if (w4[i]) rd(w4[i]); } assert.deepEqual(interleaved.sort(), ['a', 'b'], 'two big messages at once do not mix');
  const { srv } = world(); const c = client(srv, 'Ver', 'warrior'); assert.equal(c.conn.msgs.find((m) => m.t === 'welcome').ver, PROTOCOL);
});

import { heldFor, applyHeld, installRestored } from '../src/server/restore.js';
test('if the world is wiped, what the market was holding for a player (listings, order and request escrow) is handed back', () => {
  const { srv } = world(); const sm = client(srv, 'Lister', 'blacksmith'), buyer = client(srv, 'Payer', 'warrior'); const bd = getMap('town').points.find((p) => p.kind === 'exchange');
  sm.S.map = 'town'; sm.S.x = bd.x + 0.5; sm.S.y = bd.y + 1.5; sm.send('interact', { id: bd.id }); sm.P.level = 6;
  R.addItem(sm.P, 'iron_ore', 12); sm.send('market.list', { itemId: 'iron_ore', qty: 10, price: 9 });
  const g = R.addGear(sm.P, { id: 'iron_sword', q: 0.8 }); sm.send('market.list', { itemId: 'iron_sword', price: 140, uid: g.uid });
  buyer.P.gilt = 900; buyer.send('req.new', { to: 'Lister', itemId: 'iron_sword', price: 200 });
  const ore0 = R.count(sm.P, 'iron_ore'), held = heldFor(srv, sm.P); assert.ok(held.items.some(([id, n]) => id === 'iron_ore' && n === 10), 'the 10 ore on the board'); assert.equal(held.gear.length, 1, 'the sword on the board');
  const heldB = heldFor(srv, buyer.P); assert.equal(heldB.gilt, 200, 'the buyer\'s request escrow');
  // a brand-new world (wiped disk): the signed copy restores the character, then the held things are returned
  const { srv: fresh } = world(); const rec = JSON.parse(JSON.stringify(sm.P)); const P = installRestored(fresh, rec); assert.ok(P); applyHeld(P, held);
  assert.equal(R.count(P, 'iron_ore'), ore0 + 10); assert.ok(P.gear.some((x) => x.id === 'iron_sword' && x.q === 0.8)); assert.ok(P.mail.some((m) => /market was holding/.test(m)));
  const B = installRestored(fresh, JSON.parse(JSON.stringify(buyer.P))); const gold = B.gilt; applyHeld(B, heldB); assert.equal(B.gilt, gold + 200, 'escrowed gilt is returned');
});
